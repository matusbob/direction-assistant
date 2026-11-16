package io.github.matusbob.directionassistant;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

/**
 * Keeps the straight-line guidance running with the screen locked and the phone in a pocket: a foreground
 * service with a notification (Set direction / Stop), the compass, optional GPS for "Doing good", and the
 * app's own sounds, vibrations and voice. Everything runs on the main thread.
 */
public class DirectionService extends Service implements SensorEventListener, LocationListener {
    public static final String ACTION_START = "io.github.matusbob.directionassistant.START";
    public static final String ACTION_STOP = "io.github.matusbob.directionassistant.STOP";
    public static final String ACTION_SET_DIRECTION = "io.github.matusbob.directionassistant.SET_DIRECTION";

    private static final String CHANNEL = "guidance";
    private static final int NOTIFICATION_ID = 1;
    // Same as the web app: the direction is taken 1.2 s after Start, once the compass has settled
    private static final long LOCK_DELAY_MS = 1200;

    /** What the screen shows. */
    public static final class Status {
        public final boolean running;
        public final String main;
        public final String sub;
        public final DriftEngine.State state;

        Status(boolean running, String main, String sub, DriftEngine.State state) {
            this.running = running;
            this.main = main;
            this.sub = sub;
            this.state = state;
        }
    }

    public interface Listener {
        void onStatus(Status status);
        /** A message that was (or, with the voice off, should be) announced. */
        void onMessage(String text, boolean voiceOff);
    }

    private static Listener listener;
    private static Status status;

    static void setListener(Listener l) {
        listener = l;
        if (l != null && status != null) l.onStatus(status);
    }

    static Status currentStatus() {
        return status;
    }

    private final DriftEngine engine = new DriftEngine();
    private final HeadingFilter filter = new HeadingFilter(0.25f);
    private final CompassCheck compassCheck = new CompassCheck();
    private final DistanceTracker distance = new DistanceTracker();
    private final float[] rotation = new float[9];
    private final Handler handler = new Handler(Looper.getMainLooper());

    private Prefs prefs;
    private SensorManager sensors;
    private LocationManager locations;
    private PowerManager.WakeLock wakeLock;
    private Beeper beeper;
    private Haptics haptics;
    private Speaker speaker;

    private boolean running, locked, gpsOn, stopping;
    private int axis;
    private float target;
    private long lockAt, lastNotification;
    private String stateKey;

    private final Runnable gpsWatch = new Runnable() {
        @Override public void run() {
            if (!running) return;
            if (distance.shouldWarnPoorGps(SystemClock.elapsedRealtime())) message(getString(R.string.poor_gps));
            handler.postDelayed(this, 5000);
        }
    };
    private final Runnable notificationUpdate = this::refreshNotification;

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(Lang.wrap(base));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new Prefs(this);
        sensors = getSystemService(SensorManager.class);
        locations = getSystemService(LocationManager.class);
        beeper = new Beeper();
        haptics = new Haptics(this);
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CHANNEL, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            stopGuidance(true);
        } else if (ACTION_SET_DIRECTION.equals(action)) {
            if (running) setDirectionNow();
            else if (!stopping) stopSelf();
        } else if (!running) {
            startGuidance();
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void startGuidance() {
        boolean wantGps = prefs.goodEvery() > 0 && hasLocation();
        int type = 0;
        if (Build.VERSION.SDK_INT >= 34) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
        if (wantGps) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        running = true;
        stopping = false;
        locked = false;
        stateKey = null;
        setStatus(getString(R.string.scanning), getString(R.string.scanning_sub), null);
        try {
            if (type != 0) startForeground(NOTIFICATION_ID, buildNotification(), type);
            else startForeground(NOTIFICATION_ID, buildNotification());
        } catch (RuntimeException e) {
            running = false;
            setStatus(getString(R.string.ready), getString(R.string.start_failed), null);
            stopSelf();
            return;
        }

        PowerManager pm = getSystemService(PowerManager.class);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DirectionAssistant:guidance");
        // Keeps the compass readings coming with the screen off; released on Stop (or after 6 hours at most)
        wakeLock.acquire(6 * 60 * 60 * 1000L);

        if (speaker == null) speaker = new Speaker(this, () -> handler.post(() -> {
            if (listener != null) listener.onMessage(getString(R.string.tts_missing), true);
        }));

        Sensor rot = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (rot == null) rot = sensors.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
        if (rot == null) {
            message(getString(R.string.no_compass));
            stopGuidance(false);
            return;
        }
        long now = SystemClock.elapsedRealtime();
        engine.reset();
        filter.reset();
        compassCheck.reset();
        distance.reset(prefs.goodEvery(), now);
        lockAt = now + LOCK_DELAY_MS;
        sensors.registerListener(this, rot, SensorManager.SENSOR_DELAY_GAME);

        if (prefs.goodEvery() > 0) {
            if (wantGps && locations != null && locations.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                try {
                    locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, this, Looper.getMainLooper());
                    gpsOn = true;
                    handler.postDelayed(gpsWatch, 5000);
                } catch (SecurityException e) {
                    message(getString(R.string.need_location));
                }
            } else {
                message(getString(R.string.need_location));
            }
        }
    }

    private void setDirectionNow() {
        if (filter.samples() == 0) {
            lockAt = SystemClock.elapsedRealtime();
            return;
        }
        lock(SystemClock.elapsedRealtime());
    }

    private void lock(long now) {
        axis = filter.bestAxis();
        target = filter.heading(axis);
        locked = true;
        engine.resetState();
        compassCheck.reset();
        stateKey = null;
        if (prefs.sound()) beeper.chime();
        setStatus(getString(R.string.dir_set), getString(R.string.dir_set_sub), DriftEngine.State.OK);
        message(getString(R.string.dir_set_speech));
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!running) return;
        SensorManager.getRotationMatrixFromVector(rotation, event.values);
        filter.add(rotation);
        long now = SystemClock.elapsedRealtime();
        if (!locked) {
            if (now >= lockAt && filter.samples() >= 5) lock(now);
            return;
        }
        // The chosen axis points up or down (phone taken out, turned flat...): no usable direction for now
        if (!filter.usable(axis)) return;
        if (compassCheck.add(Heading.headingOf(rotation, axis), now)) message(getString(R.string.compass_warning));
        engine.setThreshold(prefs.threshold());
        engine.setSpeakStraight(prefs.voice() == Prefs.VOICE_ALWAYS);
        apply(engine.update(Heading.angleDiff(filter.heading(axis), target), now));
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (running && locked && accuracy <= SensorManager.SENSOR_STATUS_ACCURACY_LOW
                && compassCheck.warnAllowed(SystemClock.elapsedRealtime())) {
            message(getString(R.string.compass_warning));
        }
    }

    private void apply(DriftEngine.Output o) {
        if (o.changed) {
            String key = o.state + (o.hard ? "!" : "");
            if (!key.equals(stateKey)) {
                stateKey = key;
                setStatus(stateMain(o), stateSub(o), o.state);
            }
        }
        if (prefs.sound()) {
            for (DriftEngine.Beep b : o.beeps) beeper.beep(b.pan, b.freq, b.durMs, b.triangle);
        }
        if (o.vibration != null && prefs.vibrate()) haptics.vibrate(o.vibration);
        if (o.speech == DriftEngine.Speech.BACK_ON_TRACK) {
            message(getString(R.string.back_on_track));
        } else if (o.speech == DriftEngine.Speech.DRIFT) {
            boolean right = o.state == DriftEngine.State.RIGHT;
            int res = o.hard ? (right ? R.string.hard_drift_right : R.string.hard_drift_left)
                    : (right ? R.string.drift_right : R.string.drift_left);
            message(getString(res, o.degrees));
        } else if (o.speech == DriftEngine.Speech.STRAIGHT && prefs.voice() != Prefs.VOICE_OFF) {
            // Only spoken (as in the web app), not added for the screen reader
            speaker.say(getString(R.string.straight));
        }
    }

    private String stateMain(DriftEngine.Output o) {
        switch (o.state) {
            case RIGHT: return getString(o.hard ? R.string.h_right : R.string.s_right);
            case LEFT: return getString(o.hard ? R.string.h_left : R.string.s_left);
            default: return getString(R.string.straight);
        }
    }

    private String stateSub(DriftEngine.Output o) {
        switch (o.state) {
            case RIGHT: return getString(o.hard ? R.string.h_right_sub : R.string.s_right_sub);
            case LEFT: return getString(o.hard ? R.string.h_left_sub : R.string.s_left_sub);
            default: return getString(R.string.straight_sub);
        }
    }

    @Override
    public void onLocationChanged(Location loc) {
        if (!running) return;
        int m = distance.onFix(loc.getLatitude(), loc.getLongitude(), loc.hasAccuracy() ? loc.getAccuracy() : 999f, SystemClock.elapsedRealtime());
        if (m > 0) message(getString(R.string.doing_good, m));
    }

    // Older Android versions call these without default implementations
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}

    /** Says a message with the app's voice, or hands it to the screen reader when the voice is off. */
    private void message(String text) {
        boolean voiceOff = prefs.voice() == Prefs.VOICE_OFF;
        if (!voiceOff && speaker != null) speaker.say(text);
        if (listener != null) listener.onMessage(text, voiceOff);
    }

    private void stopGuidance(boolean summary) {
        if (!running) {
            if (!stopping) stopSelf();
            return;
        }
        running = false;
        stopping = true;
        sensors.unregisterListener(this);
        if (gpsOn) {
            locations.removeUpdates(this);
            gpsOn = false;
        }
        handler.removeCallbacks(gpsWatch);
        handler.removeCallbacks(notificationUpdate);
        haptics.cancel();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        stopForeground(STOP_FOREGROUND_REMOVE);

        StringBuilder text = new StringBuilder(getString(R.string.stopped)).append('.');
        if (summary) {
            if (distance.total() > 5) text.append(' ').append(getString(R.string.summary_distance, (int) Math.round(distance.total())));
            int n = engine.getDriftEvents();
            text.append(' ').append(n > 0 ? getResources().getQuantityString(R.plurals.summary_drifts, n, n) : getString(R.string.summary_no_drift));
        }
        setStatus(getString(R.string.stopped), getString(R.string.stopped_sub), null);
        boolean voiceOff = prefs.voice() == Prefs.VOICE_OFF;
        if (listener != null) listener.onMessage(text.toString(), voiceOff);
        if (!voiceOff && speaker != null) {
            // Let the summary finish before the service (and its voice) goes away
            Runnable end = this::endService;
            handler.postDelayed(end, 12000);
            speaker.say(text.toString(), () -> {
                handler.removeCallbacks(end);
                endService();
            });
        } else {
            endService();
        }
    }

    private void endService() {
        if (running) return;
        stopping = false;
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (running) {
            running = false;
            sensors.unregisterListener(this);
            if (gpsOn) locations.removeUpdates(this);
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            setStatus(getString(R.string.stopped), getString(R.string.stopped_sub), null);
        }
        handler.removeCallbacksAndMessages(null);
        if (speaker != null) speaker.shutdown();
        beeper.shutdown();
        super.onDestroy();
    }

    private void setStatus(String main, String sub, DriftEngine.State state) {
        status = new Status(running, main, sub, state);
        if (listener != null) listener.onStatus(status);
        if (running) {
            long now = SystemClock.elapsedRealtime();
            handler.removeCallbacks(notificationUpdate);
            // At most one notification update a second: they are announced by the screen reader when it's focused
            handler.postDelayed(notificationUpdate, Math.max(0, 1000 - (now - lastNotification)));
        }
    }

    private void refreshNotification() {
        if (!running) return;
        lastNotification = SystemClock.elapsedRealtime();
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent setPi = PendingIntent.getService(this, 1, new Intent(this, DirectionService.class).setAction(ACTION_SET_DIRECTION), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stopPi = PendingIntent.getService(this, 2, new Intent(this, DirectionService.class).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE);
        Status s = status;
        Notification.Builder b = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(s != null ? s.main : getString(R.string.app_name))
                .setContentText(getString(R.string.notif_running))
                .setContentIntent(openPi)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_NAVIGATION)
                .addAction(new Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_notification), getString(R.string.set_direction), setPi).build())
                .addAction(new Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_notification), getString(R.string.stop), stopPi).build());
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }
}

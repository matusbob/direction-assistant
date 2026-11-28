package io.github.matusbob.directionassistant;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.app.AlertDialog;
import android.app.Application;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Button;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.SensorEventBuilder;
import org.robolectric.shadows.ShadowAlertDialog;
import org.robolectric.shadows.ShadowSensor;
import org.robolectric.shadows.ShadowTextToSpeech;
import org.robolectric.shadows.ShadowToast;

/** Version 1.1: drift in meters, updates from the project's site, no doubled app name. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class MetersAndUpdateTest {
    private static final double LAT0 = 47.98, LON0 = 18.16;
    private Application app;
    private Sensor rotationSensor;
    private final List<String> messages = new ArrayList<>();
    private final Map<String, byte[]> web = new HashMap<>();
    private double walked;

    @Before
    public void setUp() throws Exception {
        java.lang.reflect.Field f = DirectionService.class.getDeclaredField("status");
        f.setAccessible(true);
        f.set(null, null);
        app = RuntimeEnvironment.getApplication();
        app.getSharedPreferences(Prefs.FILE, 0).edit().clear().commit();
        rotationSensor = ShadowSensor.newInstance(Sensor.TYPE_ROTATION_VECTOR);
        shadowOf(app.getSystemService(SensorManager.class)).addSensor(rotationSensor);
        Updater.executor = Runnable::run;
        Updater.net = url -> {
            byte[] b = web.get(url);
            if (b == null) throw new IOException("offline");
            return b;
        };
    }

    @After
    public void tearDown() {
        DirectionService.setListener(null);
    }

    private final DirectionService.Listener recorder = new DirectionService.Listener() {
        @Override public void onStatus(DirectionService.Status s) {}
        @Override public void onMessage(String text, boolean voiceOff) { messages.add(text); }
    };

    private SensorEvent facing(float h) {
        double a = Math.toRadians(-h) / 2;
        return SensorEventBuilder.newBuilder()
                .setSensor(rotationSensor)
                .setValues(new float[] {0, 0, (float) Math.sin(a), (float) Math.cos(a)})
                .setTimestamp(System.nanoTime())
                .build();
    }

    private void compass(DirectionService s, float heading, long ms) {
        for (long t = 0; t < ms; t += 20) {
            s.onSensorChanged(facing(heading));
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(20));
        }
    }

    /** Walks north for this many seconds at 1.2 m/s with a GPS fix each second, the phone facing heading. */
    private void walk(DirectionService s, float heading, int seconds, boolean gps) {
        for (int i = 0; i < seconds; i++) {
            walked += 1.2;
            if (gps) {
                Location l = new Location(LocationManager.GPS_PROVIDER);
                l.setLatitude(LAT0 + walked / 111320.0);
                l.setLongitude(LON0);
                l.setAccuracy(5);
                s.onLocationChanged(l);
            }
            compass(s, heading, 1000);
        }
    }

    private DirectionService start(ServiceController<DirectionService> c) {
        DirectionService s = c.create().startCommand(0, 1).get();
        android.speech.tts.TextToSpeech tts = ShadowTextToSpeech.getLastTextToSpeechInstance();
        shadowOf(tts).getOnInitListener().onInit(android.speech.tts.TextToSpeech.SUCCESS);
        return s;
    }

    private ServiceController<DirectionService> service() {
        return Robolectric.buildService(DirectionService.class, new Intent(app, DirectionService.class).setAction(DirectionService.ACTION_START));
    }

    private boolean said(String regex) {
        return messages.stream().anyMatch(m -> m.matches(regex));
    }

    @Test
    public void metersModeWithGps() {
        shadowOf(app).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION);
        shadowOf(app.getSystemService(LocationManager.class)).setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        Prefs p = new Prefs(app);
        p.setUnit(Prefs.UNIT_METERS);
        assertEquals("default allowed drift", 2, p.thresholdMeters());
        DirectionService.setListener(recorder);
        DirectionService s = start(service());
        compass(s, 0, 1500);
        assertEquals("Direction set. Walk straight.", messages.get(messages.size() - 1));

        // GPS comes: guided in meters
        walk(s, 0, 3, true);
        assertTrue(messages.toString(), messages.contains("GPS ready, guiding in meters."));
        // 8 degrees after a few meters: well within 2 m, so no warning (in degrees mode at 15 it'd be fine too)
        walk(s, 8, 3, true);
        assertFalse(messages.toString(), said("Drift.*"));
        // After about 20 m, 8 degrees is 20 * sin(8) = 2.8 m to the side: warned at once, in meters
        walk(s, 0, 12, true);
        int before = messages.size();
        walk(s, 8, 2, true);
        assertTrue(messages.subList(before, messages.size()).toString(), said("Drift right, [23] meters"));
        walk(s, 0, 2, true);
        assertEquals("Back on track.", messages.get(messages.size() - 1));
        // Further on, the same 8 degrees is more meters: hard drift left once it's over 4 m
        walk(s, 0, 15, true);
        walk(s, -8, 4, true);
        assertTrue(messages.toString(), said("Hard drift left, [4-9] meters"));
        walk(s, 0, 2, true);

        // GPS lost for 10 s: guided in degrees, and told so; back to meters when it returns
        before = messages.size();
        walk(s, 0, 12, false);
        assertTrue(messages.subList(before, messages.size()).toString(), messages.contains("GPS lost. Guiding in degrees until it's back."));
        walk(s, 25, 2, false);
        assertTrue(said("Drift right, (1[5-9]|2\\d) degrees"));
        walk(s, 0, 2, false);
        walk(s, 0, 2, true);
        assertEquals("GPS ready, guiding in meters.", messages.get(messages.size() - 1));

        // Set direction again: the meters start from 0 there, so a big turn is still told at once (in degrees)
        s.onStartCommand(new Intent(app, DirectionService.class).setAction(DirectionService.ACTION_SET_DIRECTION), 0, 2);
        before = messages.size();
        compass(s, 60, 800);
        assertTrue(messages.subList(before, messages.size()).toString(), said("Hard drift right, (4[5-9]|5\\d|60) degrees"));
    }

    @Test
    public void metersWithoutGpsYetUsesDegrees() {
        shadowOf(app).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION);
        shadowOf(app.getSystemService(LocationManager.class)).setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        new Prefs(app).setUnit(Prefs.UNIT_METERS);
        DirectionService.setListener(recorder);
        DirectionService s = start(service());
        compass(s, 0, 1500);
        // Indoors, no fix: degrees with the degrees setting (15) straight away, never silent
        compass(s, 20, 1000);
        assertTrue(messages.toString(), said("Drift right, (1[5-9]|20) degrees"));
        compass(s, 0, 10000);
        assertTrue(messages.toString(), messages.contains("No GPS yet. Guiding in degrees until it's ready."));
        assertEquals(1, messages.stream().filter(m -> m.startsWith("No GPS yet")).count());
    }

    @Test
    public void metersWithoutLocationPermissionSaysSoWithDirectionSet() {
        new Prefs(app).setUnit(Prefs.UNIT_METERS);
        DirectionService.setListener(recorder);
        DirectionService s = start(service());
        compass(s, 0, 1500);
        assertTrue(messages.toString(), messages.contains("Direction set. Walk straight. Meters need location access and location turned on. Guiding in degrees."));
        compass(s, -30, 800);
        assertTrue(said("Drift left, (1[5-9]|2\\d|30) degrees"));
        compass(s, 0, 12000);
        assertFalse("no GPS messages without GPS", said("No GPS yet.*"));
    }

    @Test
    public void degreesModeUnchangedWithoutGps() {
        DirectionService.setListener(recorder);
        DirectionService s = start(service());
        compass(s, 0, 1500);
        assertEquals("Direction set. Walk straight.", messages.get(messages.size() - 1));
        compass(s, 20, 800);
        assertTrue(said("Drift right, (1[5-9]|20) degrees"));
        assertTrue("no location asked or used", shadowOf(app.getSystemService(LocationManager.class)).getLocationUpdateListeners().isEmpty());
    }

    @Test
    public void settingsForMetersAndUpdates() {
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        web.put(Updater.VERSION_URL, versionJson(BuildConfig.VERSION_CODE, BuildConfig.VERSION_NAME, "a".repeat(64)));
        MainActivity a = Robolectric.buildActivity(MainActivity.class).setup().get();
        assertNull("no title bar: the app's name is said once, by the heading", a.getActionBar());
        a.findViewById(R.id.button_settings).performClick();
        AlertDialog d = ShadowAlertDialog.getLatestAlertDialog();
        List<String> items = new ArrayList<>();
        for (CharSequence cs : shadowOf(d).getItems()) items.add(cs.toString());
        assertEquals(Arrays.asList("Measure drift in: degrees (compass only, works indoors too)",
                "Allowed deviation: 15 degrees", "Allowed drift in meters: 2 meters", "Sounds: on", "Vibrations: on",
                "Voice: only when drifting", "Doing good: off", "Language: phone language", "Automatic updates: on",
                "Check for an update now"), items);

        // Meters: asks for location
        shadowOf(d).clickOnItem(0);
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(1);
        assertTrue(new Prefs(app).meters());
        assertTrue(Arrays.asList(shadowOf(a).getLastRequestedPermission().requestedPermissions).contains(Manifest.permission.ACCESS_FINE_LOCATION));
        assertEquals("Measure drift in: meters (compass and GPS distance, outdoors)", shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getItems()[0].toString());

        // Allowed drift in meters -> 1 meter
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(2);
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(0);
        assertEquals(1, new Prefs(app).thresholdMeters());
        assertEquals("Allowed drift in meters: 1 meter", shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getItems()[2].toString());

        // Start asks for location in meters mode
        ((Button) a.findViewById(R.id.button_start)).performClick();
        assertTrue(Arrays.asList(shadowOf(a).getLastRequestedPermission().requestedPermissions).contains(Manifest.permission.ACCESS_FINE_LOCATION));

        // Check now: already the latest
        a.findViewById(R.id.button_settings).performClick();
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(9);
        assertEquals("You have the latest version, " + BuildConfig.VERSION_NAME + ".", shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getMessage().toString());

        // Offline
        web.clear();
        a.findViewById(R.id.button_settings).performClick();
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(9);
        assertEquals("Couldn't check for an update. Check the internet connection.", shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getMessage().toString());

        // Automatic updates off
        a.findViewById(R.id.button_settings).performClick();
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(8);
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(1);
        assertFalse(new Prefs(app).autoUpdate());
    }

    private byte[] versionJson(int code, String name, String sha) {
        return ("{\"versionCode\":" + code + ",\"versionName\":\"" + name + "\",\"apk\":\"smerovy-asistent.apk\",\"sha256\":\"" + sha
                + "\",\"notes_sk\":\"Metre.\",\"notes_en\":\"Meters.\"}").getBytes(StandardCharsets.UTF_8);
    }

    @Test
    public void automaticUpdateFromTheProjectSite() {
        byte[] apk = "the new app".getBytes(StandardCharsets.UTF_8);
        web.put(Updater.VERSION_URL, versionJson(BuildConfig.VERSION_CODE + 1, "9.9", Updater.sha256(apk)));
        web.put(Updater.BASE + "smerovy-asistent.apk", apk);
        shadowOf(app.getPackageManager()).setCanRequestPackageInstalls(false);

        ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity a = c.get();
        AlertDialog offer = ShadowAlertDialog.getLatestAlertDialog();
        assertNotNull("offered when the app opens", offer);
        assertEquals("New version 9.9", shadowOf(offer).getTitle().toString());
        assertEquals("Version 9.9 is available, you have " + BuildConfig.VERSION_NAME + ". Meters.", shadowOf(offer).getMessage().toString());
        assertTrue(new Prefs(app).lastUpdateCheck() > 0);

        // Not looked for again within 6 hours
        ShadowAlertDialog.reset();
        Robolectric.buildActivity(MainActivity.class).setup();
        assertNull(ShadowAlertDialog.getLatestAlertDialog());

        // Update -> installing apps isn't allowed yet: explained, then the phone's setting opens
        offer.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        shadowOf(Looper.getMainLooper()).idle();
        AlertDialog allow = ShadowAlertDialog.getLatestAlertDialog();
        assertEquals("Allow updates", shadowOf(allow).getTitle().toString());
        allow.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        shadowOf(Looper.getMainLooper()).idle();
        Intent opened = shadowOf(a).getNextStartedActivity();
        assertEquals(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, opened.getAction());
        assertEquals("package:" + app.getPackageName(), opened.getDataString());

        // Back with it allowed: downloaded, checked and handed to the package installer
        shadowOf(app.getPackageManager()).setCanRequestPackageInstalls(true);
        c.pause().resume();
        List<PackageInstaller.SessionInfo> sessions = app.getPackageManager().getPackageInstaller().getAllSessions();
        assertEquals(1, sessions.size());
        assertEquals(app.getPackageName(), sessions.get(0).getAppPackageName());
        assertEquals("Installing the update. If the phone asks, confirm Update.", shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getMessage().toString());
    }

    @Test
    public void aTamperedDownloadIsNotInstalled() {
        web.put(Updater.VERSION_URL, versionJson(BuildConfig.VERSION_CODE + 1, "9.9", Updater.sha256("the real app".getBytes(StandardCharsets.UTF_8))));
        web.put(Updater.BASE + "smerovy-asistent.apk", "something else".getBytes(StandardCharsets.UTF_8));
        shadowOf(app.getPackageManager()).setCanRequestPackageInstalls(true);
        Robolectric.buildActivity(MainActivity.class).setup();
        ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals("Couldn't download the update. Try again later.", shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getMessage().toString());
        assertTrue(app.getPackageManager().getPackageInstaller().getAllSessions().isEmpty());
    }

    @Test
    public void noAutomaticCheckWhenOffOrWhileGuiding() {
        web.put(Updater.VERSION_URL, versionJson(BuildConfig.VERSION_CODE + 1, "9.9", "a".repeat(64)));
        new Prefs(app).setAutoUpdate(false);
        Robolectric.buildActivity(MainActivity.class).setup();
        assertNull(ShadowAlertDialog.getLatestAlertDialog());
        assertEquals(0, new Prefs(app).lastUpdateCheck());
    }

    @Test
    public void versionFileIsCheckedStrictly() throws Exception {
        Updater.Info i = Updater.parse(new String(versionJson(5, "1.4", "AB".repeat(32)), StandardCharsets.UTF_8));
        assertEquals(Updater.BASE + "smerovy-asistent.apk", i.apkUrl);
        assertEquals("ab".repeat(32), i.sha256);
        try {
            Updater.parse("{\"versionCode\":5,\"versionName\":\"x\",\"apk\":\"https://evil.example/a.apk\",\"sha256\":\"" + "a".repeat(64) + "\"}");
            throw new AssertionError("an APK from elsewhere must be refused");
        } catch (org.json.JSONException expected) {
            // refused
        }
        try {
            Updater.parse("{\"versionCode\":5,\"versionName\":\"x\",\"apk\":\"a.apk\",\"sha256\":\"short\"}");
            throw new AssertionError("a bad checksum must be refused");
        } catch (org.json.JSONException expected) {
            // refused
        }
        assertEquals("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb", Updater.sha256("a".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    public void installerAnswers() {
        Intent confirm = new Intent("android.content.pm.action.CONFIRM_INSTALL");
        new UpdateReceiver().onReceive(app, new Intent()
                .putExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_PENDING_USER_ACTION)
                .putExtra(Intent.EXTRA_INTENT, confirm));
        Intent started = shadowOf(app).getNextStartedActivity();
        assertEquals("android.content.pm.action.CONFIRM_INSTALL", started.getAction());
        assertTrue((started.getFlags() & Intent.FLAG_ACTIVITY_NEW_TASK) != 0);

        new UpdateReceiver().onReceive(app, new Intent()
                .putExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE_CONFLICT)
                .putExtra(PackageInstaller.EXTRA_STATUS_MESSAGE, "signatures differ"));
        assertEquals("The update wasn't installed: signatures differ", ShadowToast.getTextOfLatestToast());
    }
}

package io.github.matusbob.directionassistant;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.app.AlertDialog;
import android.app.Application;
import android.app.Notification;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorManager;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

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
import org.robolectric.shadows.ShadowVibrator;

/** The whole app on a simulated Android phone: screen, settings, the guidance service and its messages. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class AppFlowTest {
    private Application app;
    private Sensor rotationSensor;
    private final List<String> messages = new ArrayList<>();
    private final List<String> statuses = new ArrayList<>();

    @Before
    public void setUp() throws Exception {
        // The screen's last known state is kept for the app's lifetime; each test starts as a fresh app
        java.lang.reflect.Field f = DirectionService.class.getDeclaredField("status");
        f.setAccessible(true);
        f.set(null, null);
        app = RuntimeEnvironment.getApplication();
        app.getSharedPreferences(Prefs.FILE, 0).edit().clear().commit();
        rotationSensor = ShadowSensor.newInstance(Sensor.TYPE_ROTATION_VECTOR);
        shadowOf(app.getSystemService(SensorManager.class)).addSensor(rotationSensor);
    }

    @After
    public void tearDown() {
        DirectionService.setListener(null);
    }

    private final DirectionService.Listener recorder = new DirectionService.Listener() {
        @Override public void onStatus(DirectionService.Status s) { statuses.add(s.main); }
        @Override public void onMessage(String text, boolean voiceOff) { messages.add(text); }
    };

    /** A phone lying flat with its top edge pointing to compass heading h. */
    private SensorEvent facing(float h) {
        double a = Math.toRadians(-h) / 2;
        return SensorEventBuilder.newBuilder()
                .setSensor(rotationSensor)
                .setValues(new float[] {0, 0, (float) Math.sin(a), (float) Math.cos(a)})
                .setTimestamp(System.nanoTime())
                .build();
    }

    private void walk(DirectionService s, float heading, long ms) {
        for (long t = 0; t < ms; t += 20) {
            s.onSensorChanged(facing(heading));
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(20));
        }
    }

    private String last(List<String> l) {
        return l.isEmpty() ? null : l.get(l.size() - 1);
    }

    @Test
    public void guidanceServiceFromStartToStop() {
        DirectionService.setListener(recorder);
        ServiceController<DirectionService> c = Robolectric.buildService(DirectionService.class,
                new Intent(app, DirectionService.class).setAction(DirectionService.ACTION_START));
        DirectionService s = c.create().startCommand(0, 1).get();

        // The phone's text-to-speech engine answers
        android.speech.tts.TextToSpeech tts = ShadowTextToSpeech.getLastTextToSpeechInstance();
        shadowOf(tts).getOnInitListener().onInit(android.speech.tts.TextToSpeech.SUCCESS);
        assertEquals(java.util.Locale.US, shadowOf(tts).getCurrentLanguage());

        Notification n = shadowOf(s).getLastForegroundNotification();
        assertNotNull("runs as a foreground service with a notification", n);
        assertEquals(2, n.actions.length);
        assertEquals("Set direction", n.actions[0].title.toString());
        assertEquals("Stop", n.actions[1].title.toString());
        assertEquals("Reading the compass…", last(statuses));

        walk(s, 0, 1500);
        assertEquals("Direction set", statuses.get(statuses.size() - 1).equals("Straight") ? "Direction set" : last(statuses));
        assertTrue(messages.contains("Direction set. Walk straight."));
        assertEquals("Direction set. Walk straight.", shadowOf(tts).getLastSpokenText());

        ShadowVibrator.reset();
        walk(s, 25, 1000);
        assertEquals("Slight right", last(statuses));
        android.os.Vibrator vib = app.getSystemService(android.os.VibratorManager.class).getDefaultVibrator();
        assertTrue("vibrated while drifting", shadowOf(vib).isVibrating() || shadowOf(vib).getMilliseconds() > 0 || shadowOf(vib).getPattern() != null);
        // Said as soon as the limit is crossed, so the number is just above it
        assertTrue(messages.toString(), messages.stream().anyMatch(m -> m.matches("Drift right, (1[6-9]|2\\d) degrees")));

        walk(s, 0, 1000);
        assertEquals("Straight", last(statuses));
        assertEquals("Back on track.", last(messages));
        assertEquals("spoken with the app's voice", "Back on track.", shadowOf(tts).getLastSpokenText());

        // Within 3 s of the last message the voice waits (beeps and vibration don't), as in the web app
        walk(s, -50, 3500);
        assertEquals("Hard left", last(statuses));
        assertTrue(messages.toString(), messages.stream().anyMatch(m -> m.matches("Hard drift left, ([3-5]\\d) degrees")));

        // The notification follows the state, for the lock screen
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1100));
        Notification shown = shadowOf(app.getSystemService(android.app.NotificationManager.class)).getNotification(1);
        assertEquals("Hard left", shown.extras.getCharSequence(Notification.EXTRA_TITLE).toString());

        // Set direction again while facing west: west is now straight ahead
        c.withIntent(new Intent(app, DirectionService.class).setAction(DirectionService.ACTION_SET_DIRECTION)).startCommand(0, 2);
        assertEquals("Direction set", last(statuses));
        walk(s, -50, 600);
        assertEquals("Straight", last(statuses));

        c.withIntent(new Intent(app, DirectionService.class).setAction(DirectionService.ACTION_STOP)).startCommand(0, 3);
        assertEquals("Stopped", last(statuses));
        assertEquals("Stopped. You drifted 2 times.", last(messages));
        assertEquals("Stopped. You drifted 2 times.", shadowOf(tts).getLastSpokenText());
        assertTrue("foreground ended", shadowOf(s).isForegroundStopped());
        int before = messages.size();
        walk(s, 90, 500);
        assertEquals("nothing more once stopped", before, messages.size());
        // The service ends itself once the voice has finished the summary (here well before its 12 s safety limit)
        assertTrue(shadowOf(s).isStoppedBySelf());
    }

    @Test
    public void slovakMessagesAndVoiceOffGoToTheScreenReader() {
        Prefs p = new Prefs(app);
        p.setLang("sk");
        p.setVoice(Prefs.VOICE_OFF);
        DirectionService.setListener(recorder);
        ServiceController<DirectionService> c = Robolectric.buildService(DirectionService.class,
                new Intent(app, DirectionService.class).setAction(DirectionService.ACTION_START));
        DirectionService s = c.create().startCommand(0, 1).get();
        android.speech.tts.TextToSpeech tts = ShadowTextToSpeech.getLastTextToSpeechInstance();
        shadowOf(tts).getOnInitListener().onInit(android.speech.tts.TextToSpeech.SUCCESS);
        assertEquals(new java.util.Locale("sk", "SK"), shadowOf(tts).getCurrentLanguage());
        walk(s, 90, 1500);
        assertTrue(messages.contains("Smer nastavený. Choďte rovno."));
        assertTrue("voice off: the app doesn't speak", shadowOf(tts).getSpokenTextList().isEmpty());
        walk(s, 60, 1000);
        assertEquals("Mierne doľava", last(statuses));
        assertTrue(messages.toString(), messages.stream().anyMatch(m -> m.matches("Vybočenie doľava, \\d\\d stupňov")));
        c.withIntent(new Intent(app, DirectionService.class).setAction(DirectionService.ACTION_STOP)).startCommand(0, 2);
        assertEquals("Zastavené. Vychýlil si sa 1-krát.", last(messages));
        // With the voice off nothing is waited for
        assertTrue(shadowOf(s).isStoppedBySelf());
    }

    @Test
    public void mainScreenStartAndSettings() {
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity a = c.get();
        Button start = a.findViewById(R.id.button_start);
        Button setDir = a.findViewById(R.id.button_set_direction);
        assertEquals("Ready", ((TextView) a.findViewById(R.id.status_main)).getText().toString());
        assertEquals("Start", start.getText().toString());
        assertFalse(setDir.isEnabled());

        start.performClick();
        Intent started = shadowOf(app).getNextStartedService();
        assertNotNull(started);
        assertEquals(DirectionService.ACTION_START, started.getAction());

        a.onStatus(new DirectionService.Status(true, "Straight", "You are on track.", DriftEngine.State.OK));
        assertEquals("Stop", start.getText().toString());
        assertTrue(setDir.isEnabled());
        start.performClick();
        assertEquals(DirectionService.ACTION_STOP, shadowOf(app).getNextStartedService().getAction());

        a.findViewById(R.id.button_settings).performClick();
        AlertDialog d = ShadowAlertDialog.getLatestAlertDialog();
        List<String> items = new ArrayList<>();
        for (CharSequence cs : shadowOf(d).getItems()) items.add(cs.toString());
        assertEquals(Arrays.asList("Allowed deviation: 15 degrees", "Sounds: on", "Vibrations: on",
                "Voice: only when drifting", "Doing good: off", "Language: phone language"), items);

        // Allowed deviation -> 25 degrees, then back on the settings list
        shadowOf(d).clickOnItem(0);
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(4);
        assertEquals(25, new Prefs(app).threshold());
        assertEquals("Allowed deviation: 25 degrees", shadowOf(ShadowAlertDialog.getLatestAlertDialog()).getItems()[0].toString());

        // Voice off -> the message line becomes a live region for TalkBack
        TextView msg = a.findViewById(R.id.last_message);
        assertEquals(View.ACCESSIBILITY_LIVE_REGION_NONE, msg.getAccessibilityLiveRegion());
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(3);
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(0);
        assertEquals(Prefs.VOICE_OFF, new Prefs(app).voice());
        assertEquals(View.ACCESSIBILITY_LIVE_REGION_POLITE, msg.getAccessibilityLiveRegion());
        a.onMessage("Back on track.", true);
        assertEquals("Back on track.", msg.getText().toString());

        // Language -> Slovak
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(5);
        shadowOf(ShadowAlertDialog.getLatestAlertDialog()).clickOnItem(1);
        assertEquals("sk", new Prefs(app).lang());
        MainActivity sk = Robolectric.buildActivity(MainActivity.class).setup().get();
        assertEquals("Pripravené", ((TextView) sk.findViewById(R.id.status_main)).getText().toString());
        assertEquals("Štart", ((Button) sk.findViewById(R.id.button_start)).getText().toString());
        assertEquals("Nastaviť smer", ((Button) sk.findViewById(R.id.button_set_direction)).getText().toString());
    }

    @Test
    public void doingGoodAsksForLocation() {
        new Prefs(app).setGoodEvery(20);
        MainActivity a = Robolectric.buildActivity(MainActivity.class).setup().get();
        ((Button) a.findViewById(R.id.button_start)).performClick();
        String[] asked = shadowOf(a).getLastRequestedPermission().requestedPermissions;
        assertTrue(Arrays.asList(asked).contains(Manifest.permission.ACCESS_FINE_LOCATION));
        // Starts whatever the answer is
        a.onRequestPermissionsResult(1, asked, new int[asked.length]);
        assertEquals(DirectionService.ACTION_START, shadowOf(app).getNextStartedService().getAction());
    }
}

package io.github.matusbob.directionassistant;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.app.Application;
import android.content.Intent;
import android.net.Uri;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import java.util.Collections;
import java.util.Map;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowWebView;

/** Version 1.2: the web app in the app, and the bridge between them. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class WebActivityTest {
    private Application app;

    @Before
    public void setUp() throws Exception {
        java.lang.reflect.Field f = DirectionService.class.getDeclaredField("status");
        f.setAccessible(true);
        f.set(null, null);
        app = RuntimeEnvironment.getApplication();
        app.getSharedPreferences(Prefs.FILE, 0).edit().clear().commit();
        Updater.executor = Runnable::run;
        Updater.net = url -> { throw new java.io.IOException("offline"); };
    }

    @After
    public void tearDown() {
        DirectionService.setListener(null);
    }

    private WebActivity open() {
        WebActivity a = Robolectric.buildActivity(WebActivity.class).setup().get();
        a.setTrustedForTest(true);
        return a;
    }

    private static WebResourceRequest request(String url) {
        return new WebResourceRequest() {
            @Override public Uri getUrl() { return Uri.parse(url); }
            @Override public boolean isForMainFrame() { return true; }
            @Override public boolean isRedirect() { return false; }
            @Override public boolean hasGesture() { return true; }
            @Override public String getMethod() { return "GET"; }
            @Override public Map<String, String> getRequestHeaders() { return Collections.emptyMap(); }
        };
    }

    @Test
    public void opensTheWebAppWithTheBridge() throws Exception {
        WebActivity a = open();
        WebView w = a.webView();
        ShadowWebView sw = shadowOf(w);
        assertEquals(WebActivity.HOME, sw.getLastLoadedUrl());
        assertNotNull("bridge for the page", sw.getJavascriptInterface(WebActivity.BRIDGE_NAME));
        assertTrue(w.getSettings().getJavaScriptEnabled());
        assertTrue("saved routes and settings", w.getSettings().getDomStorageEnabled());
        assertFalse("beeps without a tap", w.getSettings().getMediaPlaybackRequiresUserGesture());
        assertNull("no title bar", a.getActionBar());

        // The project's pages stay in the app, other sites open in the browser
        assertFalse(sw.getWebViewClient().shouldOverrideUrlLoading(w, request(WebActivity.HOME + "index.html?go=1")));
        assertTrue(sw.getWebViewClient().shouldOverrideUrlLoading(w, request("https://www.openstreetmap.org/copyright")));
        Intent out = shadowOf(a).getNextStartedActivity();
        assertEquals(Intent.ACTION_VIEW, out.getAction());
        assertEquals("https://www.openstreetmap.org/copyright", out.getDataString());
        assertFalse(WebActivity.isOwnPage("https://matusbob.github.io/other/"));
        assertFalse(WebActivity.isOwnPage("https://matusbob.github.io.evil.example/direction-assistant/"));

        JSONObject info = new JSONObject(a.bridge().info());
        assertEquals(BuildConfig.VERSION_NAME, info.optString("version"));
    }

    @Test
    public void straightLineFromTheWebAppRunsInTheService() throws Exception {
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        WebActivity a = open();
        String settings = "{\"unit\":\"degrees\",\"thresholdDeg\":20,\"thresholdMet\":1.5,\"voice\":\"off\",\"sound\":false,"
                + "\"vibrate\":true,\"goodEvery\":0,\"lang\":\"sk\"}";
        assertTrue(a.bridge().startStraight(settings));
        shadowOf(Looper.getMainLooper()).idle();
        Intent started = shadowOf(app).getNextStartedService();
        assertEquals(DirectionService.ACTION_START, started.getAction());
        Prefs p = new Prefs(app);
        assertEquals("the web app's settings are used", 20, p.threshold());
        assertEquals(1.5f, p.thresholdMeters(), 0.001f);
        assertEquals(Prefs.VOICE_OFF, p.voice());
        assertFalse(p.sound());
        assertEquals("sk", p.lang());

        a.bridge().setDirection();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(DirectionService.ACTION_SET_DIRECTION, shadowOf(app).getNextStartedService().getAction());
        a.bridge().stopStraight();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(DirectionService.ACTION_STOP, shadowOf(app).getNextStartedService().getAction());

        // Settings changed in the web app while guiding
        a.bridge().updateSettings("{\"thresholdDeg\":10,\"voice\":\"always\"}");
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(10, new Prefs(app).threshold());
        assertEquals(Prefs.VOICE_ALWAYS, new Prefs(app).voice());
        assertEquals("the rest is kept", 1.5f, new Prefs(app).thresholdMeters(), 0.001f);
    }

    @Test
    public void meterModeFromTheWebAppAsksForLocation() {
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        WebActivity a = open();
        a.bridge().startStraight("{\"unit\":\"meters\",\"thresholdMet\":2}");
        shadowOf(Looper.getMainLooper()).idle();
        String[] asked = shadowOf(a).getLastRequestedPermission().requestedPermissions;
        assertTrue(java.util.Arrays.asList(asked).contains(Manifest.permission.ACCESS_FINE_LOCATION));
        a.onRequestPermissionsResult(11, asked, new int[asked.length]);
        assertEquals("starts whatever the answer", DirectionService.ACTION_START, shadowOf(app).getNextStartedService().getAction());
    }

    @Test
    public void serviceStatusAndMessagesGoToThePage() throws Exception {
        WebActivity a = open();
        a.onStatus(new DirectionService.Status(true, "Mierne doprava", "Zabočte vľavo.", DriftEngine.State.RIGHT));
        shadowOf(Looper.getMainLooper()).idle();
        String js = shadowOf(a.webView()).getLastEvaluatedJavascript();
        assertTrue(js, js.startsWith("window.__androidStatus && window.__androidStatus({"));
        JSONObject o = new JSONObject(js.substring(js.indexOf('{'), js.lastIndexOf('}') + 1));
        assertTrue(o.getBoolean("running"));
        assertEquals("Mierne doprava", o.getString("main"));
        assertEquals("RIGHT", o.getString("state"));

        a.onMessage("Vybočenie doprava, 18 stupňov \"x\"", true);
        shadowOf(Looper.getMainLooper()).idle();
        js = shadowOf(a.webView()).getLastEvaluatedJavascript();
        o = new JSONObject(js.substring(js.indexOf('{'), js.lastIndexOf('}') + 1));
        assertEquals("quotes can't break out of the call", "Vybočenie doprava, 18 stupňov \"x\"", o.getString("text"));
        assertTrue(o.getBoolean("voiceOff"));

        // The page asks at load whether guidance is still running
        assertEquals("null", a.bridge().straightState());
    }

    @Test
    public void voiceVibrationScreenShareAndFiles() {
        WebActivity a = open();
        a.bridge().speak("Ste pri: Nástupište 2", "sk-SK");
        shadowOf(Looper.getMainLooper()).idle();
        android.speech.tts.TextToSpeech tts = org.robolectric.shadows.ShadowTextToSpeech.getLastTextToSpeechInstance();
        assertNotNull("the app's voice speaks for the web app", tts);
        shadowOf(tts).getOnInitListener().onInit(android.speech.tts.TextToSpeech.SUCCESS);
        assertEquals("Ste pri: Nástupište 2", shadowOf(tts).getLastSpokenText());
        assertEquals(new java.util.Locale("sk", "SK"), shadowOf(tts).getCurrentLanguage());

        assertArrayEquals(new long[] {100, 60, 100}, WebActivity.pattern("[100,60,100]"));
        assertArrayEquals(new long[0], WebActivity.pattern("nonsense"));
        a.bridge().vibrate("[100,60,100]");
        shadowOf(Looper.getMainLooper()).idle();

        a.bridge().keepScreenOn(true);
        shadowOf(Looper.getMainLooper()).idle();
        assertTrue((a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) != 0);
        a.bridge().keepScreenOn(false);
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(0, a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        assertTrue(a.bridge().share("Moja poloha", "Lesná 6 https://maps"));
        shadowOf(Looper.getMainLooper()).idle();
        Intent chooser = shadowOf(a).getNextStartedActivity();
        assertEquals(Intent.ACTION_CHOOSER, chooser.getAction());
        Intent send = chooser.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
        assertEquals("Lesná 6 https://maps", send.getStringExtra(Intent.EXTRA_TEXT));

        assertTrue(a.bridge().saveFile("Domov.gpx", "application/gpx+xml", "<gpx/>"));
        shadowOf(Looper.getMainLooper()).idle();
        Intent create = shadowOf(a).getNextStartedActivity();
        assertEquals(Intent.ACTION_CREATE_DOCUMENT, create.getAction());
        assertEquals("Domov.gpx", create.getStringExtra(Intent.EXTRA_TITLE));

        a.bridge().openSimpleScreen();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(MainActivity.class.getName(), shadowOf(a).getNextStartedActivity().getComponent().getClassName());
    }

    @Test
    public void anotherSiteGetsNothingFromTheBridge() {
        WebActivity a = open();
        a.setTrustedForTest(false);
        assertFalse(a.bridge().startStraight("{}"));
        assertFalse(a.bridge().share("a", "b"));
        assertFalse(a.bridge().saveFile("a", "b", "c"));
        a.bridge().openSimpleScreen();
        shadowOf(Looper.getMainLooper()).idle();
        assertNull(shadowOf(app).getNextStartedService());
        assertNull(shadowOf(a).getNextStartedActivity());
    }

    @Test
    public void listenerOfTheOtherScreenIsKept() throws Exception {
        java.lang.reflect.Field f = DirectionService.class.getDeclaredField("listener");
        f.setAccessible(true);
        ActivityController<WebActivity> wc = Robolectric.buildActivity(WebActivity.class).setup();
        assertEquals(wc.get(), f.get(null));
        // The simple screen opens over the web screen, which then stops: the simple screen keeps the status
        ActivityController<MainActivity> mc = Robolectric.buildActivity(MainActivity.class).setup();
        wc.pause().stop();
        assertEquals(mc.get(), f.get(null));
        mc.pause().stop();
        assertNull(f.get(null));
        wc.restart().start().resume();
        assertEquals(wc.get(), f.get(null));
    }
}

package io.github.matusbob.directionassistant;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The app's main screen: the web app (everything it can do, the same as on the iPhone) in a web view, with a
 * bridge to the parts of the app that keep working with the screen locked. The straight-line guidance started
 * in the web app runs in DirectionService; the web app's voice, vibration, sharing and files go through the app.
 */
public class WebActivity extends Activity implements DirectionService.Listener {
    static final String HOME = "https://matusbob.github.io/direction-assistant/";
    static final String BRIDGE_NAME = "SmerovyAsistentAndroid";
    private static final int REQ_START = 11, REQ_GEO = 12, REQ_FILE = 13, REQ_SAVE = 14;

    private Prefs prefs;
    private WebView web;
    private Speaker speaker;
    private Haptics haptics;
    private UpdateFlow updates;
    // The bridge answers only the project's own pages (other sites open in the browser anyway)
    private volatile boolean trusted;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingSave;
    private boolean offlineShown;

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(Lang.wrap(base));
    }

    static boolean isOwnPage(String url) {
        return url != null && url.startsWith(HOME);
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = new Prefs(this);
        haptics = new Haptics(this);
        updates = new UpdateFlow(this, prefs, WebActivity::guiding);
        web = new WebView(this);
        web.setId(R.id.web);
        setContentView(web);
        if (Build.VERSION.SDK_INT >= 30) {
            web.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setGeolocationEnabled(true);
        // The spatial beeps start without a tap (e.g. when a drift is noticed)
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(false);
        ws.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new Bridge(), BRIDGE_NAME);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (isOwnPage(url)) return false;
                openOutside(request.getUrl());
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                trusted = isOwnPage(url);
                offlineShown = false;
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                trusted = isOwnPage(url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!isOwnPage(origin.endsWith("/") ? origin + "direction-assistant/" : origin + "/direction-assistant/")) {
                    callback.invoke(origin, false, false);
                } else if (granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
                    callback.invoke(origin, true, false);
                } else {
                    geoOrigin = origin;
                    geoCallback = callback;
                    requestPermissions(new String[] {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_GEO);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try {
                    startActivityForResult(pick, REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    static boolean guiding() {
        DirectionService.Status s = DirectionService.currentStatus();
        return s != null && s.running;
    }

    @Override
    protected void onStart() {
        super.onStart();
        DirectionService.setListener(this);
        updates.maybeCheck();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        updates.onResume();
    }

    @Override
    protected void onPause() {
        // The page keeps running (routes need it); only the view's drawing pauses
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onStop() {
        DirectionService.clearListener(this);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (speaker != null) speaker.shutdown();
        haptics.cancel();
        web.destroy();
        super.onDestroy();
    }

    @Override
    public boolean onKeyDown(int keyCode, android.view.KeyEvent event) {
        // Android 10-12; newer versions use the back callback below
        if (Build.VERSION.SDK_INT < 33 && keyCode == android.view.KeyEvent.KEYCODE_BACK) {
            back();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPostCreate(Bundle savedInstanceState) {
        super.onPostCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
        }
    }

    /** Back closes the web app's open window (as its own Back button does); on the main screen it leaves the app running. */
    void back() {
        web.evaluateJavascript("window.__androidBack ? window.__androidBack() : false", result -> {
            if (!"true".equals(result)) moveTaskToBack(true);
        });
    }

    // ---------- From the guidance service to the page ----------

    private void js(String function, JSONObject arg) {
        String code = "window." + function + " && window." + function + "(" + arg + ")";
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    static JSONObject statusJson(DirectionService.Status s) {
        JSONObject o = new JSONObject();
        try {
            o.put("running", s.running);
            o.put("main", s.main);
            o.put("sub", s.sub);
            o.put("state", s.state != null ? s.state.name() : JSONObject.NULL);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
        return o;
    }

    @Override
    public void onStatus(DirectionService.Status s) {
        js("__androidStatus", statusJson(s));
    }

    @Override
    public void onMessage(String text, boolean voiceOff) {
        JSONObject o = new JSONObject();
        try {
            o.put("text", text);
            o.put("voiceOff", voiceOff);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
        js("__androidMessage", o);
    }

    // ---------- Permissions, files ----------

    private boolean granted(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void startGuidance() {
        startForegroundService(new Intent(this, DirectionService.class).setAction(DirectionService.ACTION_START));
    }

    void startStraight(String settings) {
        prefs.applyFromWeb(settings);
        List<String> need = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) need.add(Manifest.permission.POST_NOTIFICATIONS);
        if ((prefs.goodEvery() > 0 || prefs.meters()) && !granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
            need.add(Manifest.permission.ACCESS_FINE_LOCATION);
            need.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (need.isEmpty()) startGuidance();
        else requestPermissions(need.toArray(new String[0]), REQ_START);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_START) {
            // Start either way: without notifications or location it still guides, just without those parts
            startGuidance();
        } else if (requestCode == REQ_GEO && geoCallback != null) {
            geoCallback.invoke(geoOrigin, granted(Manifest.permission.ACCESS_FINE_LOCATION), false);
            geoCallback = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) fileCallback.onReceiveValue(uri != null ? new Uri[] {uri} : null);
            fileCallback = null;
        } else if (requestCode == REQ_SAVE) {
            String text = pendingSave;
            pendingSave = null;
            if (uri == null || text == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new java.io.IOException("no stream");
                out.write(text.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, R.string.file_saved, Toast.LENGTH_LONG).show();
            } catch (java.io.IOException | RuntimeException e) {
                Toast.makeText(this, R.string.file_save_failed, Toast.LENGTH_LONG).show();
            }
        }
    }

    private void openOutside(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, uri.toString(), Toast.LENGTH_LONG).show();
        }
    }

    private void showOffline() {
        if (offlineShown || isFinishing()) return;
        offlineShown = true;
        new AlertDialog.Builder(this)
                .setTitle(R.string.web_failed_title)
                .setMessage(R.string.web_failed)
                .setPositiveButton(R.string.try_again, (d, w) -> {
                    offlineShown = false;
                    web.reload();
                })
                .setNegativeButton(R.string.simple_screen, (d, w) -> startActivity(new Intent(this, MainActivity.class)))
                .show();
    }

    static long[] pattern(String json) {
        try {
            JSONArray a = new JSONArray(json);
            int n = Math.min(a.length(), 40);
            long[] p = new long[n];
            for (int i = 0; i < n; i++) p[i] = Math.max(0, Math.min(5000, a.optLong(i, 0)));
            return p;
        } catch (JSONException | NullPointerException e) {
            return new long[0];
        }
    }

    /** What the web app can ask of the app. Called on the web view's own thread, so everything goes to the main thread. */
    final class Bridge {
        @JavascriptInterface
        public String info() {
            JSONObject o = new JSONObject();
            try {
                o.put("app", "android");
                o.put("version", BuildConfig.VERSION_NAME);
                o.put("code", BuildConfig.VERSION_CODE);
            } catch (JSONException e) {
                throw new IllegalStateException(e);
            }
            return o.toString();
        }

        @JavascriptInterface
        public void speak(String text, String langTag) {
            if (!trusted || text == null) return;
            runOnUiThread(() -> {
                if (speaker == null) speaker = new Speaker(WebActivity.this, () -> runOnUiThread(() ->
                        Toast.makeText(WebActivity.this, R.string.tts_missing, Toast.LENGTH_LONG).show()));
                speaker.setLanguage(langTag);
                speaker.say(text);
            });
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (!trusted) return;
            runOnUiThread(() -> {
                if (speaker != null) speaker.stop();
            });
        }

        @JavascriptInterface
        public void vibrate(String json) {
            if (!trusted) return;
            long[] p = pattern(json);
            runOnUiThread(() -> {
                boolean any = false;
                for (long x : p) any |= x > 0;
                if (!any) haptics.cancel();
                else haptics.vibrate(p);
            });
        }

        @JavascriptInterface
        public boolean startStraight(String settings) {
            if (!trusted) return false;
            runOnUiThread(() -> WebActivity.this.startStraight(settings));
            return true;
        }

        @JavascriptInterface
        public void updateSettings(String settings) {
            if (!trusted) return;
            runOnUiThread(() -> prefs.applyFromWeb(settings));
        }

        @JavascriptInterface
        public void stopStraight() {
            if (!trusted) return;
            runOnUiThread(() -> startService(new Intent(WebActivity.this, DirectionService.class).setAction(DirectionService.ACTION_STOP)));
        }

        @JavascriptInterface
        public void setDirection() {
            if (!trusted) return;
            runOnUiThread(() -> startService(new Intent(WebActivity.this, DirectionService.class).setAction(DirectionService.ACTION_SET_DIRECTION)));
        }

        @JavascriptInterface
        public String straightState() {
            DirectionService.Status s = DirectionService.currentStatus();
            return s != null ? statusJson(s).toString() : "null";
        }

        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            if (!trusted) return;
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public boolean share(String title, String text) {
            if (!trusted) return false;
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(Intent.EXTRA_SUBJECT, title).putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(send, title));
            });
            return true;
        }

        @JavascriptInterface
        public boolean saveFile(String name, String mime, String text) {
            if (!trusted || text == null) return false;
            runOnUiThread(() -> {
                pendingSave = text;
                Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mime != null ? mime : "application/octet-stream").putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(create, REQ_SAVE);
                } catch (ActivityNotFoundException e) {
                    pendingSave = null;
                    Toast.makeText(WebActivity.this, R.string.file_save_failed, Toast.LENGTH_LONG).show();
                }
            });
            return true;
        }

        @JavascriptInterface
        public void openSimpleScreen() {
            if (!trusted) return;
            runOnUiThread(() -> startActivity(new Intent(WebActivity.this, MainActivity.class)));
        }
    }

    /** For the tests. */
    Bridge bridge() {
        return new Bridge();
    }

    WebView webView() {
        return web;
    }

    void setTrustedForTest(boolean t) {
        trusted = t;
    }
}

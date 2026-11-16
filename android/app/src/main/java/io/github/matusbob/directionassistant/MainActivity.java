package io.github.matusbob.directionassistant;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** One screen: Start / Stop, Set direction, Settings. */
public class MainActivity extends Activity implements DirectionService.Listener {
    private static final int REQ_START = 1;
    private static final int REQ_LOCATION = 2;

    private Prefs prefs;
    private TextView statusMain, statusSub, lastMessage;
    private Button startButton, setDirectionButton;
    private boolean running;

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(Lang.wrap(base));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        prefs = new Prefs(this);
        statusMain = findViewById(R.id.status_main);
        statusSub = findViewById(R.id.status_sub);
        lastMessage = findViewById(R.id.last_message);
        startButton = findViewById(R.id.button_start);
        setDirectionButton = findViewById(R.id.button_set_direction);
        Button settingsButton = findViewById(R.id.button_settings);
        ((TextView) findViewById(R.id.version)).setText(getString(R.string.version, BuildConfig.VERSION_NAME));

        View root = findViewById(R.id.root);
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }

        startButton.setOnClickListener(v -> {
            if (running) send(DirectionService.ACTION_STOP);
            else startWithPermissions();
        });
        setDirectionButton.setOnClickListener(v -> send(DirectionService.ACTION_SET_DIRECTION));
        settingsButton.setOnClickListener(v -> showSettings());
    }

    @Override
    protected void onStart() {
        super.onStart();
        DirectionService.Status s = DirectionService.currentStatus();
        render(s != null ? s : new DirectionService.Status(false, getString(R.string.ready), getString(R.string.ready_sub), null));
        DirectionService.setListener(this);
        applyAnnouncerMode();
    }

    @Override
    protected void onStop() {
        DirectionService.setListener(null);
        super.onStop();
    }

    @Override
    public void onStatus(DirectionService.Status s) {
        render(s);
    }

    @Override
    public void onMessage(String text, boolean voiceOff) {
        // With the app's voice off this view is a live region, so the screen reader reads the message;
        // with the voice on it only shows it (otherwise everything would be said twice)
        lastMessage.setText(text);
    }

    private void render(DirectionService.Status s) {
        running = s.running;
        statusMain.setText(s.main);
        statusSub.setText(s.sub);
        startButton.setText(running ? R.string.stop : R.string.start);
        setDirectionButton.setEnabled(running);
        int color;
        if (s.state == DriftEngine.State.OK) color = R.color.status_ok;
        else if (s.state == DriftEngine.State.RIGHT || s.state == DriftEngine.State.LEFT) color = R.color.status_drift;
        else color = R.color.status_idle;
        statusMain.setTextColor(getColor(color));
    }

    private void applyAnnouncerMode() {
        lastMessage.setAccessibilityLiveRegion(prefs.voice() == Prefs.VOICE_OFF
                ? View.ACCESSIBILITY_LIVE_REGION_POLITE : View.ACCESSIBILITY_LIVE_REGION_NONE);
    }

    private void send(String action) {
        startService(new Intent(this, DirectionService.class).setAction(action));
    }

    private boolean granted(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void startWithPermissions() {
        List<String> need = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) need.add(Manifest.permission.POST_NOTIFICATIONS);
        if (prefs.goodEvery() > 0 && !granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
            need.add(Manifest.permission.ACCESS_FINE_LOCATION);
            need.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (need.isEmpty()) startGuidance();
        else requestPermissions(need.toArray(new String[0]), REQ_START);
    }

    private void startGuidance() {
        startForegroundService(new Intent(this, DirectionService.class).setAction(DirectionService.ACTION_START));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        // Start either way: without notifications or location it still guides, just without those parts
        if (requestCode == REQ_START) startGuidance();
    }

    // ---------- Settings: a list; each item opens its choices and then returns to the list ----------

    private String onOff(boolean on) {
        return getString(on ? R.string.on : R.string.off);
    }

    private String voiceName(int v) {
        return getString(v == Prefs.VOICE_OFF ? R.string.voice_off : v == Prefs.VOICE_ALWAYS ? R.string.voice_always : R.string.voice_drift);
    }

    private String goodName(int m) {
        return m == 0 ? getString(R.string.off) : getString(R.string.good_every, m);
    }

    private String langName(String l) {
        return getString("sk".equals(l) ? R.string.lang_sk : "en".equals(l) ? R.string.lang_en : R.string.lang_system);
    }

    private void showSettings() {
        String[] items = {
                getString(R.string.set_threshold, prefs.threshold()),
                getString(R.string.set_sound, onOff(prefs.sound())),
                getString(R.string.set_vibration, onOff(prefs.vibrate())),
                getString(R.string.set_voice, voiceName(prefs.voice())),
                getString(R.string.set_good, goodName(prefs.goodEvery())),
                getString(R.string.set_language, langName(prefs.lang())),
        };
        new AlertDialog.Builder(this)
                .setTitle(R.string.settings)
                .setItems(items, (d, which) -> {
                    switch (which) {
                        case 0: chooseThreshold(); break;
                        case 1: chooseOnOff(R.string.sound, prefs.sound(), prefs::setSound); break;
                        case 2: chooseOnOff(R.string.vibration, prefs.vibrate(), prefs::setVibrate); break;
                        case 3: chooseVoice(); break;
                        case 4: chooseGood(); break;
                        default: chooseLanguage(); break;
                    }
                })
                .setNegativeButton(R.string.close, null)
                .show();
    }

    private interface BoolSetter { void set(boolean v); }

    private void choose(int title, String[] options, int checked, java.util.function.IntConsumer onPick) {
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setSingleChoiceItems(options, checked, (d, which) -> {
                    d.dismiss();
                    onPick.accept(which);
                })
                .setNegativeButton(R.string.back, (d, w) -> showSettings())
                .setOnCancelListener(d -> showSettings())
                .show();
    }

    private void chooseThreshold() {
        String[] opts = new String[Prefs.THRESHOLDS.length];
        int checked = 0;
        for (int i = 0; i < opts.length; i++) {
            opts[i] = getString(R.string.degrees, Prefs.THRESHOLDS[i]);
            if (Prefs.THRESHOLDS[i] == prefs.threshold()) checked = i;
        }
        choose(R.string.threshold, opts, checked, i -> {
            prefs.setThreshold(Prefs.THRESHOLDS[i]);
            showSettings();
        });
    }

    private void chooseOnOff(int title, boolean current, BoolSetter setter) {
        choose(title, new String[] {getString(R.string.on), getString(R.string.off)}, current ? 0 : 1, i -> {
            setter.set(i == 0);
            showSettings();
        });
    }

    private void chooseVoice() {
        String[] opts = {voiceName(Prefs.VOICE_OFF), voiceName(Prefs.VOICE_DRIFT), voiceName(Prefs.VOICE_ALWAYS)};
        choose(R.string.voice, opts, prefs.voice(), i -> {
            prefs.setVoice(i);
            applyAnnouncerMode();
            showSettings();
        });
    }

    private void chooseGood() {
        String[] opts = new String[Prefs.GOOD_EVERY.length];
        int checked = 0;
        for (int i = 0; i < opts.length; i++) {
            opts[i] = goodName(Prefs.GOOD_EVERY[i]);
            if (Prefs.GOOD_EVERY[i] == prefs.goodEvery()) checked = i;
        }
        choose(R.string.doing_good_title, opts, checked, i -> {
            prefs.setGoodEvery(Prefs.GOOD_EVERY[i]);
            if (Prefs.GOOD_EVERY[i] > 0 && !granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
                requestPermissions(new String[] {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            }
            showSettings();
        });
    }

    private void chooseLanguage() {
        String[] opts = new String[Prefs.LANGS.length];
        int checked = 0;
        for (int i = 0; i < opts.length; i++) {
            opts[i] = langName(Prefs.LANGS[i]);
            if (Prefs.LANGS[i].equals(prefs.lang())) checked = i;
        }
        choose(R.string.language, opts, checked, i -> {
            prefs.setLang(Prefs.LANGS[i]);
            // Rebuild the screen in the new language
            recreate();
        });
    }
}

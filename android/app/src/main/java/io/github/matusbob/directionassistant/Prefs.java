package io.github.matusbob.directionassistant;

import android.content.Context;
import android.content.SharedPreferences;

/** Settings, remembered between uses. Defaults match the web app. */
final class Prefs {
    static final String FILE = "settings";
    static final int VOICE_OFF = 0, VOICE_DRIFT = 1, VOICE_ALWAYS = 2;
    static final int[] THRESHOLDS = {5, 10, 15, 20, 25, 30, 40};
    static final int[] GOOD_EVERY = {0, 10, 20, 50, 100};
    static final String[] LANGS = {"system", "sk", "en"};

    private final SharedPreferences sp;

    Prefs(Context c) {
        sp = c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    int threshold() { return sp.getInt("threshold", 15); }
    boolean sound() { return sp.getBoolean("sound", true); }
    boolean vibrate() { return sp.getBoolean("vibrate", true); }
    int voice() { return sp.getInt("voice", VOICE_DRIFT); }
    /** "Doing good" every this many meters; 0 = off */
    int goodEvery() { return sp.getInt("goodEvery", 0); }
    String lang() { return sp.getString("lang", "system"); }

    void setThreshold(int v) { sp.edit().putInt("threshold", v).apply(); }
    void setSound(boolean v) { sp.edit().putBoolean("sound", v).apply(); }
    void setVibrate(boolean v) { sp.edit().putBoolean("vibrate", v).apply(); }
    void setVoice(int v) { sp.edit().putInt("voice", v).apply(); }
    void setGoodEvery(int v) { sp.edit().putInt("goodEvery", v).apply(); }
    // Written at once: the screen is rebuilt in the new language right after this
    @android.annotation.SuppressLint("ApplySharedPref")
    void setLang(String v) { sp.edit().putString("lang", v).commit(); }
}

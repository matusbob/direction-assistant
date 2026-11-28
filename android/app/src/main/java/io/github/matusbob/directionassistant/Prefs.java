package io.github.matusbob.directionassistant;

import android.content.Context;
import android.content.SharedPreferences;

import android.annotation.SuppressLint;

/** Settings, remembered between uses. Defaults match the web app. */
final class Prefs {
    static final String FILE = "settings";
    static final int VOICE_OFF = 0, VOICE_DRIFT = 1, VOICE_ALWAYS = 2;
    static final int[] THRESHOLDS = {5, 10, 15, 20, 25, 30, 40};
    static final int[] THRESHOLDS_M = {1, 2, 3, 4, 5, 7, 10, 15};
    static final String UNIT_DEGREES = "degrees", UNIT_METERS = "meters";
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
    /** How drifting is measured: degrees (compass only) or meters (compass and GPS distance) */
    String unit() { return sp.getString("unit", UNIT_DEGREES); }
    boolean meters() { return UNIT_METERS.equals(unit()); }
    /** Allowed sideways drift in meters, in meters mode (the web part can set halves, such as 1.5) */
    float thresholdMeters() {
        if (sp.contains("thresholdMetersF")) return sp.getFloat("thresholdMetersF", 2f);
        return sp.getInt("thresholdMeters", 2);
    }
    /** Look for a new version of the app when it opens */
    boolean autoUpdate() { return sp.getBoolean("autoUpdate", true); }
    long lastUpdateCheck() { return sp.getLong("lastUpdateCheck", 0); }

    void setThreshold(int v) { sp.edit().putInt("threshold", v).apply(); }
    void setSound(boolean v) { sp.edit().putBoolean("sound", v).apply(); }
    void setVibrate(boolean v) { sp.edit().putBoolean("vibrate", v).apply(); }
    void setVoice(int v) { sp.edit().putInt("voice", v).apply(); }
    void setGoodEvery(int v) { sp.edit().putInt("goodEvery", v).apply(); }
    void setUnit(String v) { sp.edit().putString("unit", v).apply(); }
    void setThresholdMeters(float v) { sp.edit().putFloat("thresholdMetersF", v).apply(); }

    /**
     * The settings of the web part, for guidance started there:
     * {unit, thresholdDeg, thresholdMet, voice: off|drift|always, sound, vibrate, goodEvery, lang: sk|en}.
     * Missing or wrong values are left as they are.
     */
    @SuppressLint("ApplySharedPref")
    void applyFromWeb(String json) {
        org.json.JSONObject o;
        try {
            o = new org.json.JSONObject(json);
        } catch (org.json.JSONException | NullPointerException e) {
            return;
        }
        SharedPreferences.Editor e = sp.edit();
        String unit = o.optString("unit", "");
        if (UNIT_METERS.equals(unit) || UNIT_DEGREES.equals(unit)) e.putString("unit", unit);
        double deg = o.optDouble("thresholdDeg", Double.NaN);
        if (deg >= 1 && deg <= 90) e.putInt("threshold", (int) Math.round(deg));
        double met = o.optDouble("thresholdMet", Double.NaN);
        if (met >= 0.5 && met <= 50) e.putFloat("thresholdMetersF", (float) met);
        String voice = o.optString("voice", "");
        if ("off".equals(voice)) e.putInt("voice", VOICE_OFF);
        else if ("drift".equals(voice)) e.putInt("voice", VOICE_DRIFT);
        else if ("always".equals(voice)) e.putInt("voice", VOICE_ALWAYS);
        if (o.has("sound")) e.putBoolean("sound", o.optBoolean("sound", true));
        if (o.has("vibrate")) e.putBoolean("vibrate", o.optBoolean("vibrate", true));
        int good = o.optInt("goodEvery", -1);
        if (good >= 0 && good <= 1000) e.putInt("goodEvery", good);
        String l = o.optString("lang", "");
        if ("sk".equals(l) || "en".equals(l)) e.putString("lang", l);
        e.commit();
    }
    void setAutoUpdate(boolean v) { sp.edit().putBoolean("autoUpdate", v).apply(); }
    void setLastUpdateCheck(long v) { sp.edit().putLong("lastUpdateCheck", v).apply(); }
    // Written at once: the screen is rebuilt in the new language right after this
    @SuppressLint("ApplySharedPref")
    void setLang(String v) { sp.edit().putString("lang", v).commit(); }
}

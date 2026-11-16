package io.github.matusbob.directionassistant;

import android.content.Context;
import android.content.res.Configuration;
import android.os.LocaleList;

import java.util.Locale;

/** The app's language: the phone's, or Slovak / English chosen in the settings. */
final class Lang {
    private Lang() {}

    static Context wrap(Context base) {
        String lang = base.getSharedPreferences(Prefs.FILE, Context.MODE_PRIVATE).getString("lang", "system");
        if ("system".equals(lang)) return base;
        Configuration c = new Configuration(base.getResources().getConfiguration());
        c.setLocales(new LocaleList(Locale.forLanguageTag(lang)));
        return base.createConfigurationContext(c);
    }
}

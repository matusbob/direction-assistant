package io.github.matusbob.directionassistant;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Updates from the project's site: downloads/version.json says the newest version, its APK and the APK's
 * SHA-256. The APK is checked against that and installed with the phone's package installer, which asks the
 * person to confirm (Android may skip that for later updates once this app has installed itself).
 */
final class Updater {
    private Updater() {}

    static final String BASE = "https://matusbob.github.io/direction-assistant/downloads/";
    static final String VERSION_URL = BASE + "version.json";
    private static final int MAX_APK = 30 * 1024 * 1024;

    static final class Info {
        final int versionCode;
        final String versionName, apkUrl, sha256, notesSk, notesEn;

        Info(int versionCode, String versionName, String apkUrl, String sha256, String notesSk, String notesEn) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.apkUrl = apkUrl;
            this.sha256 = sha256;
            this.notesSk = notesSk;
            this.notesEn = notesEn;
        }

        String notes(Context c) {
            return "sk".equals(c.getString(R.string.tts_lang).substring(0, 2)) ? notesSk : notesEn;
        }
    }

    /** Fetches a URL; replaced in the tests. */
    interface Net {
        byte[] get(String url) throws IOException;
    }

    static Net net = Updater::httpGet;
    static Executor executor = Executors.newSingleThreadExecutor();

    static Info parse(String json) throws JSONException {
        JSONObject o = new JSONObject(json);
        String apk = o.getString("apk");
        // Only from the project's own site, over HTTPS
        String url = apk.startsWith("https://") ? apk : BASE + apk;
        if (!url.startsWith(BASE)) throw new JSONException("APK not on the project site");
        String sha = o.getString("sha256").toLowerCase(java.util.Locale.ROOT);
        if (!sha.matches("[0-9a-f]{64}")) throw new JSONException("bad sha256");
        return new Info(o.getInt("versionCode"), o.getString("versionName"), url, sha,
                o.optString("notes_sk", ""), o.optString("notes_en", ""));
    }

    static Info fetchInfo() throws IOException {
        try {
            return parse(new String(net.get(VERSION_URL), StandardCharsets.UTF_8));
        } catch (JSONException e) {
            throw new IOException(e);
        }
    }

    static boolean isNewer(Info i) {
        return i != null && i.versionCode > BuildConfig.VERSION_CODE;
    }

    static String sha256(byte[] data) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder b = new StringBuilder();
            for (byte x : h) b.append(String.format(java.util.Locale.ROOT, "%02x", x));
            return b.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Downloads the APK and checks it; throws if it isn't exactly the published one. */
    static byte[] download(Info i) throws IOException {
        byte[] apk = net.get(i.apkUrl);
        if (!sha256(apk).equals(i.sha256)) throw new IOException("checksum mismatch");
        return apk;
    }

    /** Hands the APK to the package installer; the result goes to UpdateReceiver. */
    static void install(Context c, byte[] apk) throws IOException {
        PackageInstaller pi = c.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(c.getPackageName());
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(params);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (OutputStream out = s.openWrite("app.apk", 0, apk.length)) {
                out.write(apk);
                s.fsync(out);
            }
            Intent result = new Intent(c, UpdateReceiver.class);
            // Mutable: the installer adds the result to it
            PendingIntent p = PendingIntent.getBroadcast(c, id, result, PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            s.commit(p.getIntentSender());
        } catch (IOException | RuntimeException e) {
            pi.abandonSession(id);
            throw e;
        }
    }

    private static byte[] httpGet(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    if (out.size() > MAX_APK) throw new IOException("too large");
                }
                return out.toByteArray();
            }
        } finally {
            c.disconnect();
        }
    }
}

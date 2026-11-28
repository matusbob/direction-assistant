package io.github.matusbob.directionassistant;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import java.util.function.BooleanSupplier;

/** Looking for, offering and installing updates, on either screen of the app. */
final class UpdateFlow {
    static final long CHECK_EVERY_MS = 6 * 60 * 60 * 1000L;

    private final Activity a;
    private final Prefs prefs;
    /** True while guiding: no update then (installing ends the app) */
    private final BooleanSupplier busy;
    // An update waiting for "Install unknown apps" to be allowed in the phone's settings
    private Updater.Info pendingUpdate;
    private AlertDialog updateProgress;

    UpdateFlow(Activity a, Prefs prefs, BooleanSupplier busy) {
        this.a = a;
        this.prefs = prefs;
        this.busy = busy;
    }

    /** Back from the phone's settings with installing allowed: go on with the update. */
    void onResume() {
        if (pendingUpdate != null && a.getPackageManager().canRequestPackageInstalls()) {
            Updater.Info i = pendingUpdate;
            pendingUpdate = null;
            downloadAndInstall(i);
        }
    }


    void maybeCheck() {
        if (!prefs.autoUpdate() || busy.getAsBoolean()) return;
        if (System.currentTimeMillis() - prefs.lastUpdateCheck() < CHECK_EVERY_MS) return;
        check(false);
    }

    private void info(String text) {
        new AlertDialog.Builder(a).setMessage(text).setPositiveButton(R.string.close, null).show();
    }

    /** manual: asked from the settings, so say the result also when there's nothing new. */
    void check(boolean manual) {
        AlertDialog checking = manual ? new AlertDialog.Builder(a).setMessage(R.string.update_checking).setCancelable(false).show() : null;
        Updater.executor.execute(() -> {
            Updater.Info found;
            try {
                found = Updater.fetchInfo();
            } catch (java.io.IOException | RuntimeException e) {
                found = null;
            }
            final Updater.Info i = found;
            a.runOnUiThread(() -> {
                if (checking != null) checking.dismiss();
                if (a.isFinishing() || a.isDestroyed()) return;
                if (i == null) {
                    if (manual) info(a.getString(R.string.update_failed));
                    return;
                }
                prefs.setLastUpdateCheck(System.currentTimeMillis());
                if (Updater.isNewer(i)) offerUpdate(i);
                else if (manual) info(a.getString(R.string.update_latest, BuildConfig.VERSION_NAME));
            });
        });
    }

    private void offerUpdate(Updater.Info i) {
        new AlertDialog.Builder(a)
                .setTitle(a.getString(R.string.update_title, i.versionName))
                .setMessage(a.getString(R.string.update_available, i.versionName, BuildConfig.VERSION_NAME, i.notes(a)).trim())
                .setPositiveButton(R.string.update_now, (d, w) -> startUpdate(i))
                .setNegativeButton(R.string.later, null)
                .show();
    }

    private void startUpdate(Updater.Info i) {
        if (busy.getAsBoolean()) {
            info(a.getString(R.string.update_running));
            return;
        }
        if (!a.getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(a)
                    .setTitle(R.string.update_allow_title)
                    .setMessage(R.string.update_allow)
                    .setPositiveButton(R.string.open_settings, (d, w) -> {
                        pendingUpdate = i;
                        a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName())));
                    })
                    .setNegativeButton(R.string.later, null)
                    .show();
            return;
        }
        downloadAndInstall(i);
    }

    private void downloadAndInstall(Updater.Info i) {
        updateProgress = new AlertDialog.Builder(a).setMessage(R.string.update_downloading).setCancelable(false).show();
        Updater.executor.execute(() -> {
            String error = null;
            try {
                byte[] apk = Updater.download(i);
                Updater.install(a.getApplicationContext(), apk);
            } catch (java.io.IOException | RuntimeException e) {
                error = a.getString(R.string.update_download_failed);
            }
            final String err = error;
            a.runOnUiThread(() -> {
                if (updateProgress != null) updateProgress.dismiss();
                updateProgress = null;
                if (a.isFinishing() || a.isDestroyed()) return;
                info(err != null ? err : a.getString(R.string.update_installing));
            });
        });
    }
}

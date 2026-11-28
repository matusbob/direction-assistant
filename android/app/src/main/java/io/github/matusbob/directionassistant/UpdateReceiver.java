package io.github.matusbob.directionassistant;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

/** What the package installer says about an update: ask the person to confirm, or tell them it failed. */
public class UpdateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Context c = Lang.wrap(context);
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = android.os.Build.VERSION.SDK_INT >= 33
                    ? intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class)
                    : legacyIntentExtra(intent);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirm);
            }
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            String why = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            if (why == null || why.isEmpty()) why = String.valueOf(status);
            Toast.makeText(c, c.getString(R.string.update_install_failed, why), Toast.LENGTH_LONG).show();
        }
    }

    @SuppressWarnings("deprecation")
    private static Intent legacyIntentExtra(Intent intent) {
        return intent.getParcelableExtra(Intent.EXTRA_INTENT);
    }
}

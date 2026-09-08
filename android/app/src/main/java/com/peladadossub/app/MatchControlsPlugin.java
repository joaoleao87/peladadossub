package com.peladadossub.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "MatchControls", permissions = @Permission(alias = "notifications", strings = Manifest.permission.POST_NOTIFICATIONS))
public class MatchControlsPlugin extends Plugin {
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            String action = intent.getStringExtra("controlAction");
            if (action == null) return;
            JSObject data = new JSObject();
            data.put("action", action);
            notifyListeners("controlAction", data, true);
        }
    };

    @Override public void load() {
        ContextCompat.registerReceiver(getContext(), receiver,
            new IntentFilter(MatchControlService.EVENT_ACTION), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @PluginMethod public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult");
            return;
        }
        sendState(call, MatchControlService.ACTION_START);
    }

    @PermissionCallback private void permissionResult(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Permissão de notificações necessária para controles na tela bloqueada.");
            return;
        }
        sendState(call, MatchControlService.ACTION_START);
    }

    @PluginMethod public void update(PluginCall call) { sendState(call, MatchControlService.ACTION_UPDATE); }

    @PluginMethod public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), MatchControlService.class);
        intent.setAction(MatchControlService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    private void sendState(PluginCall call, String action) {
        Intent intent = new Intent(getContext(), MatchControlService.class);
        intent.setAction(action);
        intent.putExtra("title", call.getString("title", "Pelada dos Sub"));
        intent.putExtra("score", call.getString("score", "0 × 0"));
        intent.putExtra("subtitle", call.getString("subtitle", "Partida"));
        intent.putExtra("remainingMs", call.getLong("remainingMs", 600000L));
        intent.putExtra("running", Boolean.TRUE.equals(call.getBoolean("running", false)));
        if (MatchControlService.ACTION_START.equals(action)) ContextCompat.startForegroundService(getContext(), intent);
        else getContext().startService(intent);
        call.resolve();
    }

    @Override protected void handleOnDestroy() {
        try { getContext().unregisterReceiver(receiver); } catch (IllegalArgumentException ignored) {}
    }
}

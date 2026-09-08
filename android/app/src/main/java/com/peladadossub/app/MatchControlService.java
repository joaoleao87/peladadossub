package com.peladadossub.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.session.MediaSession;
import android.os.Build;
import android.os.IBinder;

public class MatchControlService extends Service {
    public static final String ACTION_START = "com.peladadosub.START_MATCH_CONTROLS";
    public static final String ACTION_UPDATE = "com.peladadosub.UPDATE_MATCH_CONTROLS";
    public static final String ACTION_STOP = "com.peladadosub.STOP_MATCH_CONTROLS";
    public static final String ACTION_CONTROL = "com.peladadosub.MATCH_CONTROL";
    public static final String EVENT_ACTION = "com.peladadosub.MATCH_CONTROL_EVENT";
    private static final String CHANNEL_ID = "match_controls";
    private static final int NOTIFICATION_ID = 2026;
    private MediaSession mediaSession;
    private String title = "Pelada dos Sub", score = "0 × 0", subtitle = "Partida";
    private long remainingMs = 600000;
    private boolean running;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        mediaSession = new MediaSession(this, "PeladaDosSubMatch");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override public void onSkipToPrevious() { emit("GOAL_HOME"); }
            @Override public void onSkipToNext() { emit("GOAL_AWAY"); }
            @Override public void onPlay() { emit("HIGHLIGHT"); }
            @Override public void onPause() { emit("UNDO"); }
        });
        mediaSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setActive(true);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_CONTROL.equals(action)) {
            emit(intent.getStringExtra("controlAction"));
            return START_STICKY;
        }
        title = intent.getStringExtra("title") == null ? title : intent.getStringExtra("title");
        score = intent.getStringExtra("score") == null ? score : intent.getStringExtra("score");
        subtitle = intent.getStringExtra("subtitle") == null ? subtitle : intent.getStringExtra("subtitle");
        remainingMs = intent.getLongExtra("remainingMs", remainingMs);
        running = intent.getBooleanExtra("running", running);
        startForeground(NOTIFICATION_ID, notification());
        return START_STICKY;
    }

    private Notification notification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        builder.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title + "  " + score)
            .setContentText(subtitle)
            .setOngoing(true).setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setContentIntent(PendingIntent.getActivity(this, 1, new Intent(this, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .addAction(action(android.R.drawable.ic_media_previous, "Gol esquerdo", "GOAL_HOME", 2))
            .addAction(action(android.R.drawable.btn_star, "Lance", "HIGHLIGHT", 3))
            .addAction(action(android.R.drawable.ic_media_next, "Gol direito", "GOAL_AWAY", 4))
            .addAction(action(android.R.drawable.ic_menu_revert, "Desfazer", "UNDO", 5))
            .setStyle(new Notification.MediaStyle().setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        if (running) {
            builder.setWhen(System.currentTimeMillis() + remainingMs).setUsesChronometer(true);
            if (Build.VERSION.SDK_INT >= 24) builder.setChronometerCountDown(true);
        } else builder.setSubText(formatTime(remainingMs));
        return builder.build();
    }

    private Notification.Action action(int icon, String label, String controlAction, int code) {
        Intent intent = new Intent(this, MatchControlService.class);
        intent.setAction(ACTION_CONTROL);
        intent.putExtra("controlAction", controlAction);
        PendingIntent pending = PendingIntent.getService(this, code, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Action.Builder(icon, label, pending).build();
    }

    private void emit(String action) {
        if (action == null) return;
        Intent event = new Intent(EVENT_ACTION);
        event.setPackage(getPackageName());
        event.putExtra("controlAction", action);
        sendBroadcast(event);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Controle da partida", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Placar, cronômetro e marcações da partida em andamento.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private String formatTime(long value) {
        long seconds = Math.max(0, value / 1000);
        return String.format("%02d:%02d", seconds / 60, seconds % 60);
    }

    @Override public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}

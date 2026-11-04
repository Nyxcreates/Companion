package Companion.company.usage

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import Companion.company.MainActivity

class AppUsageTrackerService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var lastNudgeTime = 0L

    companion object {
        private const val CHANNEL_ID = "companion_usage_awareness"
        private const val NOTIFICATION_ID = 2002
        private const val CHECK_INTERVAL_MS = 60_000L // check every minute
        private const val MIN_COOLDOWN_MS = 30 * 60_000L // 30 min cooldown between nudges

        // Popular entertainment / endless-scroll package identifiers
        private val DISTRACTING_PACKAGES = setOf(
            "com.instagram.android",
            "com.google.android.youtube",
            "com.zhiliaoapp.musically", // TikTok
            "com.reddit.frontpage",
            "com.twitter.android",
            "com.facebook.katana"
        )
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, createForegroundNotification())
        scheduleUsageCheck()
    }

    private fun createForegroundNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Phone Balance & Awareness",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors focus balance and gently suggests breaks"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }

        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nikki Phone Awareness")
            .setContentText("Helping you protect your focus and healthy habits.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun scheduleUsageCheck() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                evaluateRecentUsage()
                handler.postDelayed(this, CHECK_INTERVAL_MS)
            }
        }, CHECK_INTERVAL_MS)
    }

    private fun evaluateRecentUsage() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return

        val now = System.currentTimeMillis()
        if (now - lastNudgeTime < MIN_COOLDOWN_MS) return

        try {
            val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return
            val startTime = now - (25 * 60_000L) // last 25 minutes
            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, now)

            var distractingTimeMs = 0L
            for (stat in stats) {
                if (DISTRACTING_PACKAGES.contains(stat.packageName)) {
                    distractingTimeMs += stat.totalTimeInForeground
                }
            }

            // If user spent > 20 minutes in distracting apps in the last 25 minutes
            if (distractingTimeMs > 20 * 60_000L) {
                lastNudgeTime = now
                triggerGentleBreakNotification()
            }
        } catch (_: Exception) {}
    }

    private fun triggerGentleBreakNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Heyyy, quick breather? 🌿")
            .setContentText("You've been scrolling for a bit. Want to grab some water or stretch?")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        manager.notify(3001, notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }
}


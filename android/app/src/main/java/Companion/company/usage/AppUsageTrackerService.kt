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
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.TimeZone
import java.util.concurrent.Executors

class AppUsageTrackerService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private val networkExecutor = Executors.newSingleThreadExecutor()
    private var lastNudgeTime = 0L

    companion object {
        const val PREFS_NAME = "companion_usage_prefs"
        const val KEY_ID_TOKEN = "firebase_id_token"
        const val KEY_API_BASE_URL = "api_base_url"
        const val KEY_TIMEZONE = "user_timezone"

        private const val CHANNEL_ID = "companion_usage_awareness"
        private const val NOTIFICATION_ID = 2002
        private const val CHECK_INTERVAL_MS = 60_000L // check every minute
        private const val STUDY_CHECK_MIN_COOLDOWN_MS = 15 * 60_000L // 15 min cooldown
        private const val FALLBACK_COOLDOWN_MS = 30 * 60_000L // 30 min cooldown offline

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
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Monitors focus balance and gently reminds you of active tasks"
                setShowBadge(true)
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
            .setContentText("Helping you protect your focus and study blocks.")
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
        if (now - lastNudgeTime < STUDY_CHECK_MIN_COOLDOWN_MS) return

        try {
            val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return
            val startTime = now - (25 * 60_000L) // last 25 minutes
            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, now)

            var distractingTimeMs = 0L
            var topPackage = ""
            var topPackageTimeMs = 0L

            for (stat in stats) {
                if (DISTRACTING_PACKAGES.contains(stat.packageName)) {
                    distractingTimeMs += stat.totalTimeInForeground
                    if (stat.totalTimeInForeground > topPackageTimeMs) {
                        topPackageTimeMs = stat.totalTimeInForeground
                        topPackage = stat.packageName
                    }
                }
            }

            val distractingMinutes = (distractingTimeMs / 60_000L).toInt()
            if (distractingMinutes < 3) return

            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val idToken = prefs.getString(KEY_ID_TOKEN, null)
            val apiBaseUrl = prefs.getString(KEY_API_BASE_URL, null)
            val timezone = prefs.getString(KEY_TIMEZONE, TimeZone.getDefault().id) ?: TimeZone.getDefault().id

            // If connected to Companion backend, check if user has an active study/task block
            if (!idToken.isNullOrBlank() && !apiBaseUrl.isNullOrBlank()) {
                checkBackendDistraction(
                    apiBaseUrl = apiBaseUrl,
                    idToken = idToken,
                    timezone = timezone,
                    distractingMinutes = distractingMinutes,
                    foregroundPackage = topPackage
                )
                return
            }

            // Offline / unauthenticated fallback: gentle break after 20+ minutes
            if (distractingTimeMs > 20 * 60_000L && now - lastNudgeTime >= FALLBACK_COOLDOWN_MS) {
                lastNudgeTime = now
                showNudgeNotification(
                    "Heyyy, quick breather? 🌿",
                    "You've been scrolling for a bit. Want to grab some water or get back to your plan?"
                )
            }
        } catch (_: Exception) {}
    }

    private fun checkBackendDistraction(
        apiBaseUrl: String,
        idToken: String,
        timezone: String,
        distractingMinutes: Int,
        foregroundPackage: String
    ) {
        networkExecutor.execute {
            var conn: HttpURLConnection? = null
            try {
                val url = URL("$apiBaseUrl/api/usage/distraction-check")
                conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 8000
                    readTimeout = 8000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $idToken")
                }

                val payload = JSONObject().apply {
                    put("distractingMinutes", distractingMinutes)
                    put("foregroundPackage", foregroundPackage)
                    put("timezone", timezone)
                }

                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(payload.toString())
                }

                if (conn.responseCode in 200..299) {
                    val responseBody = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                    val json = JSONObject(responseBody)
                    val data = json.optJSONObject("data")
                    if (data != null && data.optBoolean("shouldNudge", false)) {
                        val title = data.optString("title", "Time to focus ✨")
                        val body = data.optString("body", "You have a task waiting — let's put the phone down!")
                        lastNudgeTime = System.currentTimeMillis()
                        handler.post {
                            showNudgeNotification(title, body)
                        }
                    }
                }
            } catch (_: Exception) {
                // Network failures should never crash the background usage service
            } finally {
                conn?.disconnect()
            }
        }
    }

    private fun showNudgeNotification(title: String, body: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        manager.notify(3001, notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        networkExecutor.shutdownNow()
    }
}

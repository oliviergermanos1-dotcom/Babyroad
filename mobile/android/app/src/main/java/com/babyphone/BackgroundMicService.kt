package com.babyphone

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service that captures microphone audio on the caregiver device and
 * hands each PCM chunk to the JS layer (via a React Native event/bridge) so it
 * can be relayed to the parent over WebSocket.
 *
 * Android requires a visible notification for a foreground mic service — that is
 * intentional and part of the privacy contract with the user.
 */
class BackgroundMicService : Service() {

    private var audioRecord: AudioRecord? = null

    @Volatile
    private var isRecording = false
    private var recordingThread: Thread? = null

    companion object {
        const val CHANNEL_ID = "babyphone_mic"
        const val NOTIFICATION_ID = 1

        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())
        startRecording()
        return START_STICKY
    }

    private fun startRecording() {
        if (isRecording) return
        isRecording = true

        recordingThread = Thread {
            val bufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT
            )

            val recorder = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
            )
            audioRecord = recorder

            recorder.startRecording()
            val buffer = ByteArray(bufferSize)

            while (isRecording) {
                val bytesRead = recorder.read(buffer, 0, bufferSize)
                if (bytesRead > 0) {
                    sendAudioChunk(buffer.copyOf(bytesRead))
                }
            }

            recorder.stop()
            recorder.release()
            audioRecord = null
        }.also { it.start() }
    }

    private fun sendAudioChunk(audioData: ByteArray) {
        // TODO: emit to React Native (e.g. DeviceEventManagerModule
        // .RCTDeviceEventEmitter -> "AudioChunk" with Base64.encodeToString(...))
        // so the JS WebSocket layer can forward it as an AUDIO_CHUNK message.
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "BabyPhone Microphone",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background microphone monitoring"
            }
            val manager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BabyPhone")
            .setContentText("Microphone active · tap to open")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        isRecording = false
        recordingThread?.join(500)
        audioRecord?.release()
        audioRecord = null
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

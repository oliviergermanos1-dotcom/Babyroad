package com.babyphone

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.LinkedBlockingQueue

/**
 * Plays the incoming 16 kHz / mono / PCM-16 audio stream on the parent device.
 *
 * JS calls start() once a stream begins, then playChunk(base64) for every
 * AUDIO_CHUNK received over the WebSocket. Chunks are decoded and written to an
 * [AudioTrack] in MODE_STREAM from a dedicated writer thread, so the React
 * Native bridge thread is never blocked by AudioTrack back-pressure.
 */
class AudioPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val sampleRate = 16000
    private var audioTrack: AudioTrack? = null
    private val queue = LinkedBlockingQueue<ByteArray>()
    private var writer: Thread? = null

    @Volatile
    private var playing = false

    override fun getName() = "AudioPlayerModule"

    @ReactMethod
    fun start(promise: Promise) {
        try {
            if (playing) {
                promise.resolve(true)
                return
            }

            val minBuf = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )

            val track = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setSampleRate(sampleRate)
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(minBuf * 2)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()
            } else {
                @Suppress("DEPRECATION")
                AudioTrack(
                    AudioManager.STREAM_MUSIC,
                    sampleRate,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    minBuf * 2,
                    AudioTrack.MODE_STREAM
                )
            }

            track.play()
            audioTrack = track
            playing = true
            queue.clear()

            writer = Thread {
                while (playing) {
                    try {
                        val data = queue.take() // blocks until a chunk arrives
                        audioTrack?.write(data, 0, data.size)
                    } catch (e: InterruptedException) {
                        break
                    }
                }
            }.also { it.start() }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_START_FAILED", e)
        }
    }

    @ReactMethod
    fun playChunk(base64: String) {
        if (!playing) return
        queue.offer(Base64.decode(base64, Base64.NO_WRAP))
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            playing = false
            writer?.interrupt()
            writer?.join(300)
            writer = null
            queue.clear()
            audioTrack?.let {
                it.pause()
                it.flush()
                it.stop()
                it.release()
            }
            audioTrack = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_STOP_FAILED", e)
        }
    }
}

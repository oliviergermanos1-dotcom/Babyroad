package com.babyphone

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * JS-facing bridge to the microphone foreground service.
 *
 * JS calls `MicModule.startCapture()` (caregiver side) to launch
 * [BackgroundMicService]; the service streams base64 PCM chunks back to JS via
 * the "AudioChunk" device event, which the JS layer forwards over WebSocket as
 * an AUDIO_CHUNK message.
 */
class MicModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        instance = this
    }

    override fun getName() = "MicModule"

    @ReactMethod
    fun startCapture(promise: Promise) {
        try {
            val intent = Intent(reactContext, BackgroundMicService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_FAILED", e)
        }
    }

    @ReactMethod
    fun stopCapture(promise: Promise) {
        try {
            reactContext.stopService(
                Intent(reactContext, BackgroundMicService::class.java)
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", e)
        }
    }

    // Required so NativeEventEmitter doesn't warn on RN >= 0.65.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    companion object {
        @Volatile
        private var instance: MicModule? = null

        /** Called from the service thread for each captured PCM chunk. */
        fun emitAudioChunk(base64: String) {
            val ctx = instance?.reactContext ?: return
            if (ctx.hasActiveReactInstance()) {
                ctx
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("AudioChunk", base64)
            }
        }
    }
}

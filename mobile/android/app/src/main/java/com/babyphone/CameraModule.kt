package com.babyphone

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Captures camera frames on the caregiver device and emits them to JS as
 * base64 JPEG ("VideoFrame" event). JS forwards each one as VIDEO_FRAME over
 * the WebSocket. Throttled to ~6 fps — this is a monitor feed, not a 4K stream,
 * so we trade frame rate for bandwidth and battery.
 *
 * Runs while the CaregiverScreen is foreground (Android forbids background
 * camera access). Uses Camera2 with a JPEG ImageReader so we get encoded frames
 * directly — no manual YUV→JPEG conversion.
 */
class CameraModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var bgThread: HandlerThread? = null
    private var bgHandler: Handler? = null

    @Volatile
    private var lastFrameMs = 0L
    private val minFrameIntervalMs = 150L // ~6-7 fps

    override fun getName() = "CameraModule"

    @ReactMethod
    fun start(promise: Promise) {
        try {
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED
            ) {
                promise.reject("NO_PERMISSION", "Camera permission not granted")
                return
            }

            startBackgroundThread()
            val manager =
                reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraId = pickCamera(manager)
            if (cameraId == null) {
                promise.reject("NO_CAMERA", "No camera available")
                return
            }

            imageReader = ImageReader.newInstance(480, 640, ImageFormat.JPEG, 2).apply {
                setOnImageAvailableListener({ reader ->
                    val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                    try {
                        val now = System.currentTimeMillis()
                        if (now - lastFrameMs >= minFrameIntervalMs) {
                            lastFrameMs = now
                            val buffer = image.planes[0].buffer
                            val bytes = ByteArray(buffer.remaining())
                            buffer.get(bytes)
                            emitFrame(Base64.encodeToString(bytes, Base64.NO_WRAP))
                        }
                    } finally {
                        image.close()
                    }
                }, bgHandler)
            }

            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(device: CameraDevice) {
                    cameraDevice = device
                    createSession(device)
                    promise.resolve(true)
                }

                override fun onDisconnected(device: CameraDevice) {
                    device.close()
                    cameraDevice = null
                }

                override fun onError(device: CameraDevice, error: Int) {
                    device.close()
                    cameraDevice = null
                }
            }, bgHandler)
        } catch (e: Exception) {
            promise.reject("CAMERA_START_FAILED", e)
        }
    }

    private fun createSession(device: CameraDevice) {
        val surface = imageReader?.surface ?: return
        val request = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
            addTarget(surface)
        }
        device.createCaptureSession(
            listOf(surface),
            object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    session.setRepeatingRequest(request.build(), null, bgHandler)
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {}
            },
            bgHandler
        )
    }

    private fun pickCamera(manager: CameraManager): String? {
        for (id in manager.cameraIdList) {
            val facing = manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING)
            if (facing == CameraCharacteristics.LENS_FACING_BACK) return id
        }
        return manager.cameraIdList.firstOrNull()
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            captureSession?.close()
            captureSession = null
            cameraDevice?.close()
            cameraDevice = null
            imageReader?.close()
            imageReader = null
            stopBackgroundThread()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CAMERA_STOP_FAILED", e)
        }
    }

    private fun startBackgroundThread() {
        bgThread = HandlerThread("CameraBg").also { it.start() }
        bgHandler = Handler(bgThread!!.looper)
    }

    private fun stopBackgroundThread() {
        bgThread?.quitSafely()
        bgThread = null
        bgHandler = null
    }

    private fun emitFrame(base64: String) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("VideoFrame", base64)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}

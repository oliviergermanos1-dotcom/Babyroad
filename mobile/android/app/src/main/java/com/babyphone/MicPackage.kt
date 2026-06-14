package com.babyphone

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers [MicModule]. Add this to your MainApplication's getPackages():
 *
 *   override fun getPackages(): List<ReactPackage> =
 *       PackageList(this).packages.apply { add(MicPackage()) }
 */
class MicPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(MicModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> = emptyList()
}

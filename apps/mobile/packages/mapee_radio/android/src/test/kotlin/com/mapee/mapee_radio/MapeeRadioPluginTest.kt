package com.mapee.mapee_radio

import kotlin.test.Test
import kotlin.test.assertEquals

/*
 * Unit test of the Kotlin portion of this plugin's implementation.
 *
 * Once you have built the plugin's example app, you can run these tests from the command
 * line by running `./gradlew testDebugUnitTest` in the `example/android/` directory, or
 * you can run them directly from IDEs that support JUnit such as Android Studio.
 */

internal class MapeeRadioPluginTest {
    @Test
    fun getRadioInfo_withoutAttachedEngine_returnsNullFieldsRatherThanThrowing() {
        val plugin = MapeeRadioPlugin()

        var result: Result<RadioInfo>? = null
        plugin.getRadioInfo { result = it }

        assertEquals(Result.success(RadioInfo(carrierName = null, radioAccessTechnology = null)), result)
    }
}

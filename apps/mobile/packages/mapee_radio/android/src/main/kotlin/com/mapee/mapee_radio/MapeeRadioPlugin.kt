package com.mapee.mapee_radio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.telephony.TelephonyManager
import io.flutter.embedding.engine.plugins.FlutterPlugin

class MapeeRadioPlugin : FlutterPlugin, RadioInfoHostApi {
    private var applicationContext: Context? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        applicationContext = binding.applicationContext
        RadioInfoHostApi.setUp(binding.binaryMessenger, this)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        applicationContext = null
        RadioInfoHostApi.setUp(binding.binaryMessenger, null)
    }

    override fun getRadioInfo(callback: (Result<RadioInfo>) -> Unit) {
        val context = applicationContext
        if (context == null) {
            callback(Result.success(RadioInfo(carrierName = null, radioAccessTechnology = null)))
            return
        }

        val telephonyManager =
            context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        if (telephonyManager == null) {
            callback(Result.success(RadioInfo(carrierName = null, radioAccessTechnology = null)))
            return
        }

        callback(
            Result.success(
                RadioInfo(
                    carrierName = readCarrierName(telephonyManager),
                    radioAccessTechnology = readRadioAccessTechnology(context, telephonyManager),
                )
            )
        )
    }

    private fun readCarrierName(telephonyManager: TelephonyManager): String? {
        return try {
            telephonyManager.networkOperatorName?.takeIf { it.isNotBlank() }
        } catch (e: SecurityException) {
            null
        } catch (e: Exception) {
            null
        }
    }

    private fun readRadioAccessTechnology(
        context: Context,
        telephonyManager: TelephonyManager,
    ): String? {
        val hasReadPhoneState =
            context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) ==
                PackageManager.PERMISSION_GRANTED
        if (!hasReadPhoneState) {
            return null
        }

        return try {
            networkTypeToRat(telephonyManager.dataNetworkType)
        } catch (e: SecurityException) {
            null
        } catch (e: Exception) {
            null
        }
    }

    // Maps TelephonyManager.NETWORK_TYPE_* constants to the generation string
    // this plugin exposes to Dart. Values not clearly 2G/3G/4G/5G (e.g. IWLAN,
    // which is Wi-Fi calling rather than a cellular RAT) fall through to null.
    private fun networkTypeToRat(networkType: Int): String? {
        return when (networkType) {
            TelephonyManager.NETWORK_TYPE_GPRS,
            TelephonyManager.NETWORK_TYPE_EDGE,
            TelephonyManager.NETWORK_TYPE_CDMA,
            TelephonyManager.NETWORK_TYPE_1xRTT,
            TelephonyManager.NETWORK_TYPE_IDEN,
            TelephonyManager.NETWORK_TYPE_GSM -> "2G"
            TelephonyManager.NETWORK_TYPE_UMTS,
            TelephonyManager.NETWORK_TYPE_EVDO_0,
            TelephonyManager.NETWORK_TYPE_EVDO_A,
            TelephonyManager.NETWORK_TYPE_HSDPA,
            TelephonyManager.NETWORK_TYPE_HSUPA,
            TelephonyManager.NETWORK_TYPE_HSPA,
            TelephonyManager.NETWORK_TYPE_EVDO_B,
            TelephonyManager.NETWORK_TYPE_EHRPD,
            TelephonyManager.NETWORK_TYPE_HSPAP,
            TelephonyManager.NETWORK_TYPE_TD_SCDMA -> "3G"
            TelephonyManager.NETWORK_TYPE_LTE -> "4G"
            TelephonyManager.NETWORK_TYPE_NR -> "5G"
            else -> null
        }
    }
}

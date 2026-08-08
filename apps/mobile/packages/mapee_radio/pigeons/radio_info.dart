import 'package:pigeon/pigeon.dart';

@ConfigurePigeon(
  PigeonOptions(
    dartOut: 'lib/src/radio_info.g.dart',
    dartOptions: DartOptions(),
    kotlinOut:
        'android/src/main/kotlin/com/mapee/mapee_radio/RadioInfo.g.kt',
    kotlinOptions: KotlinOptions(package: 'com.mapee.mapee_radio'),
    swiftOut: 'ios/mapee_radio/Sources/mapee_radio/RadioInfo.g.swift',
    swiftOptions: SwiftOptions(),
    dartPackageName: 'mapee_radio',
  ),
)
class RadioInfo {
  RadioInfo({this.carrierName, this.radioAccessTechnology});

  String? carrierName;
  String? radioAccessTechnology;
}

@HostApi()
abstract class RadioInfoHostApi {
  @async
  RadioInfo getRadioInfo();
}

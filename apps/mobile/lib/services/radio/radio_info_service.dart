import 'package:mapee_radio/mapee_radio.dart';

class RadioInfoService {
  RadioInfoService({RadioInfoHostApi? hostApi})
    : _hostApi = hostApi ?? RadioInfoHostApi();

  final RadioInfoHostApi _hostApi;

  Future<RadioInfo> getRadioInfo() => _hostApi.getRadioInfo();

  Future<String?> getCarrierName() async {
    return (await getRadioInfo()).carrierName;
  }

  Future<String?> getRadioAccessTechnology() async {
    return (await getRadioInfo()).radioAccessTechnology;
  }
}

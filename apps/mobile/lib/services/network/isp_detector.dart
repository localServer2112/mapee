import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/network_identify_repository.dart';
import '../../domain/entities/asn_info.dart';
import '../../domain/entities/isp_detection_result.dart';
import '../../domain/isp_matcher.dart';
import '../radio/radio_info_service.dart';

typedef AsnInfoFetcher = Future<AsnInfo?> Function();

/// OS-reported carrier name, backed by the `mapee_radio` plugin
/// (`RadioInfoService.getCarrierName`) via [ispDetectorProvider] below.
/// [noCarrierName] stays as the type's default so tests can construct an
/// [IspDetector] without any platform dependency.
typedef CarrierNameProvider = Future<String?> Function();

Future<String?> noCarrierName() async => null;

/// Plan §Track B Phase 3 "ISP matcher with OS/ASN dual source": prefers the
/// OS-reported carrier name over the ASN-lookup heuristic when both are
/// available, since a device-reported name is more direct than inferring
/// from network-boundary metadata.
class IspDetector {
  IspDetector({required this.fetchAsnInfo, this.carrierNameProvider = noCarrierName});

  final AsnInfoFetcher fetchAsnInfo;
  final CarrierNameProvider carrierNameProvider;

  Future<IspDetectionResult> detect() async {
    final carrierName = await carrierNameProvider();
    if (carrierName != null) {
      // A raw OS carrier name (e.g. "MTN NG") won't equal an `ispList` entry
      // exactly, so it needs the same pattern matching `detectISP` already
      // does for ASN info. Rather than duplicating `_ispPatterns`, wrap the
      // carrier name in a throwaway AsnInfo and reuse `detectISP` as-is.
      final matched = detectISP(AsnInfo(isp: carrierName, as: '', asname: '', org: ''));
      if (matched != null) {
        return IspDetectionResult(ispName: matched, source: IspDetectionSource.osCarrierName);
      }
    }

    final asnInfo = await fetchAsnInfo();
    if (asnInfo != null) {
      final matched = detectISP(asnInfo);
      if (matched != null) {
        return IspDetectionResult(ispName: matched, source: IspDetectionSource.asnLookup);
      }
    }

    return const IspDetectionResult(ispName: null, source: IspDetectionSource.none);
  }
}

final radioInfoServiceProvider = Provider<RadioInfoService>((ref) => RadioInfoService());

final ispDetectorProvider = Provider<IspDetector>((ref) {
  final networkIdentifyRepository = ref.watch(networkIdentifyRepositoryProvider);
  final radioInfoService = ref.watch(radioInfoServiceProvider);
  return IspDetector(
    fetchAsnInfo: networkIdentifyRepository.fetchAsnInfo,
    carrierNameProvider: radioInfoService.getCarrierName,
  );
});

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapee_api/mapee_api.dart';

import '../../app/providers.dart';
import '../api/api_client.dart';
import 'install_repository.dart';

class ScanSubmissionRepository {
  ScanSubmissionRepository(this._api, this._installs);

  final ApiClient _api;
  final InstallRepository _installs;

  Future<String> submitScan({
    String? id,
    required double lat,
    required double lng,
    required ISPName reportedIsp,
    String? verifiedAsn,
    required int latencyMs,
    required int jitter,
    required double uploadSpeed,
    required double downloadSpeed,
    CreateScanRequestMeasurementMethodEnum? measurementMethod,
    required DeviceType deviceType,
    String? radioType,
    int? signalDbm,
    String? mcc,
    String? mnc,
  }) async {
    final token = await _installs.ensureInstall();

    final response = await _api.scans.v1ScansPost(
      authorization: 'Bearer $token',
      createScanRequest: CreateScanRequest(
        (b) => b
          ..id = id
          ..lat = lat
          ..lng = lng
          ..reportedISP = reportedIsp
          ..verifiedASN = verifiedAsn
          ..latencyMs = latencyMs
          ..jitter = jitter
          ..uploadSpeed = uploadSpeed
          ..downloadSpeed = downloadSpeed
          ..measurementMethod = measurementMethod
          ..deviceType = deviceType
          ..radioType = radioType
          ..signalDbm = signalDbm
          ..mcc = mcc
          ..mnc = mnc,
      ),
    );

    final body = response.data;
    if (body == null) {
      throw StateError('POST /v1/scans returned no body');
    }

    return body.id;
  }
}

final scanSubmissionRepositoryProvider = Provider<ScanSubmissionRepository>(
  (ref) => ScanSubmissionRepository(ref.watch(apiClientProvider), ref.watch(installRepositoryProvider)),
);

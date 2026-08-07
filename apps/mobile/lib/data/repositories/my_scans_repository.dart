import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapee_api/mapee_api.dart';

import '../../app/providers.dart';
import '../../domain/entities/my_scan.dart';
import '../api/api_client.dart';
import 'install_repository.dart';

/// `features/` never calls `ApiClient` directly — it goes through a
/// repository (plan §2.2), mirroring `ScanSubmissionRepository`'s shape for
/// the bearer-header auth wiring.
///
/// Unlike `IspRankingRepository`'s "never throws, empty-on-error" convention
/// — appropriate there because an empty ISP-rankings result is itself an
/// expected steady state — a failed fetch here must not be indistinguishable
/// from "you genuinely have zero scans": `ActivityScreen` needs to tell a
/// user who has run scans but hit a network error apart from a user who
/// really has none, the same way `map_screen.dart`'s `_fetchVisibleAreas`
/// catches the error itself rather than a repository silently returning `[]`.
class MyScansRepository {
  MyScansRepository(this._api, this._installs);

  final ApiClient _api;
  final InstallRepository _installs;

  Future<List<MyScan>> fetchMyScans() async {
    final token = await _installs.ensureInstall();
    final response = await _api.installs.v1MeScansGet(authorization: 'Bearer $token');
    final scans = response.data;
    if (scans == null) return const [];

    return scans
        .map(
          (s) => MyScan(
            id: s.id,
            lat: s.lat.toDouble(),
            lng: s.lng.toDouble(),
            // Same dynamic-dispatch pattern as IspRankingRepository: ISPName's
            // own `.name` is the Dart-identifier form, not the human-readable
            // wire name the generated serializer already knows about.
            ispDisplayName: (ISPName.serializer as dynamic).serialize(serializers, s.reportedISP) as String,
            verifiedAsn: s.verifiedASN,
            latencyMs: s.latencyMs,
            jitterMs: s.jitter,
            uploadMbps: s.uploadSpeed.toDouble(),
            downloadMbps: s.downloadSpeed.toDouble(),
            // ScanDetail inherits `measurementMethod`'s getter from `Scan`
            // itself, so its runtime type is `ScanMeasurementMethodEnum` —
            // the separate `ScanDetailMeasurementMethodEnum` class the
            // generator emits in scan_detail.dart is unused dead code.
            isMeasured: s.measurementMethod == ScanMeasurementMethodEnum.measured,
            // DeviceType's wire names ('mobile'/'tablet'/'desktop') match its
            // Dart identifiers exactly, unlike ISPName, so `.name` is safe here.
            deviceType: s.deviceType.name,
            timestamp: s.timestamp,
          ),
        )
        .toList();
  }
}

final myScansRepositoryProvider = Provider<MyScansRepository>(
  (ref) => MyScansRepository(ref.watch(apiClientProvider), ref.watch(installRepositoryProvider)),
);

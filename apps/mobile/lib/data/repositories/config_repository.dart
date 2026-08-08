import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../domain/entities/app_config.dart';
import '../api/api_client.dart';

/// Fetches and caches `/v1/config` for the lifetime of the process — every
/// consumer (throughput service, ISP matching, latency thresholds) shares
/// one in-flight fetch rather than re-requesting.
class ConfigRepository {
  ConfigRepository(this._api);

  final ApiClient _api;
  Future<AppConfig>? _cached;

  Future<AppConfig> fetchConfig() {
    return _cached ??= _fetch();
  }

  Future<AppConfig> _fetch() async {
    final response = await _api.config.v1ConfigGet();
    final config = response.data;
    if (config == null) {
      throw StateError('GET /v1/config returned no body');
    }

    return AppConfig(
      ispList: config.ispList.toList(),
      latencyGoodMs: config.latencyThresholds.good,
      latencyFairMs: config.latencyThresholds.fair,
      measurementDownloadUrl: config.measurementEndpoints.download,
      measurementUploadUrl: config.measurementEndpoints.upload,
    );
  }
}

final configRepositoryProvider = Provider<ConfigRepository>(
  (ref) => ConfigRepository(ref.watch(apiClientProvider)),
);

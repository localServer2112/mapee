import 'dart:async';
import 'dart:typed_data';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';

import '../../data/repositories/config_repository.dart';
import '../../domain/entities/app_config.dart';
import '../../domain/entities/throughput_result.dart';

typedef ConnectivityChecker = Future<List<ConnectivityResult>> Function();

Future<List<ConnectivityResult>> _defaultCheckConnectivity() => Connectivity().checkConnectivity();

class ThroughputService {
  ThroughputService(this._configRepository, {ConnectivityChecker? checkConnectivity, Dio? dio})
      : _checkConnectivity = checkConnectivity ?? _defaultCheckConnectivity,
        _dio = dio ?? Dio();

  static const int defaultDownloadBudgetBytes = 8 * 1024 * 1024;
  static const int defaultUploadBudgetBytes = 2 * 1024 * 1024;
  static const Duration defaultTimeout = Duration(seconds: 15);

  final ConfigRepository _configRepository;
  final ConnectivityChecker _checkConnectivity;
  final Dio _dio;

  Future<ThroughputResult> measureDownload({
    int maxBytes = defaultDownloadBudgetBytes,
    Duration timeout = defaultTimeout,
    bool allowCellular = false,
  }) async {
    if (await _cellularBlocked(allowCellular)) {
      return const ThroughputResult(outcome: ThroughputOutcome.cellularConsentDenied);
    }
    if (maxBytes <= 0) {
      return const ThroughputResult(outcome: ThroughputOutcome.budgetExceeded);
    }

    final config = await _tryFetchConfig();
    if (config == null) {
      return const ThroughputResult(outcome: ThroughputOutcome.networkError);
    }

    final cancelToken = CancelToken();
    final stopwatch = Stopwatch()..start();
    final timer = Timer(timeout, () => cancelToken.cancel('timeout'));
    var bytesReceived = 0;

    try {
      final response = await _dio.get<ResponseBody>(
        config.measurementDownloadUrl,
        options: Options(responseType: ResponseType.stream),
        cancelToken: cancelToken,
      );
      await for (final chunk in response.data!.stream) {
        bytesReceived += chunk.length;
        // Budget cap: once the byte budget is hit, stop pulling data — this
        // protects the user's (often metered, Nigerian mobile) data plan.
        // Breaking out of `await for` cancels the underlying subscription,
        // and the explicit cancel() below also aborts the HTTP request
        // itself so no further bytes are read off the wire for it.
        if (bytesReceived >= maxBytes) {
          cancelToken.cancel('budget reached');
          break;
        }
      }
    } on DioException catch (e) {
      timer.cancel();
      stopwatch.stop();
      if (e.type == DioExceptionType.cancel) {
        return ThroughputResult(
          outcome: ThroughputOutcome.timeout,
          bytesTransferred: bytesReceived,
          elapsed: stopwatch.elapsed,
        );
      }
      return ThroughputResult(
        outcome: ThroughputOutcome.networkError,
        bytesTransferred: bytesReceived,
        elapsed: stopwatch.elapsed,
      );
    } catch (_) {
      timer.cancel();
      stopwatch.stop();
      return ThroughputResult(
        outcome: ThroughputOutcome.networkError,
        bytesTransferred: bytesReceived,
        elapsed: stopwatch.elapsed,
      );
    }

    timer.cancel();
    stopwatch.stop();
    return _resultFor(bytesReceived, stopwatch.elapsed, isDownload: true);
  }

  Future<ThroughputResult> measureUpload({
    int bytesToSend = defaultUploadBudgetBytes,
    Duration timeout = defaultTimeout,
    bool allowCellular = false,
  }) async {
    if (await _cellularBlocked(allowCellular)) {
      return const ThroughputResult(outcome: ThroughputOutcome.cellularConsentDenied);
    }
    if (bytesToSend <= 0) {
      return const ThroughputResult(outcome: ThroughputOutcome.budgetExceeded);
    }

    final config = await _tryFetchConfig();
    if (config == null) {
      return const ThroughputResult(outcome: ThroughputOutcome.networkError);
    }

    // Zero-filled payload: we're timing bytes-on-the-wire, not testing the
    // server's handling of any particular content — the transfer is real
    // either way.
    final payload = Uint8List(bytesToSend);
    final cancelToken = CancelToken();
    final stopwatch = Stopwatch()..start();
    final timer = Timer(timeout, () => cancelToken.cancel('timeout'));

    try {
      await _dio.post<void>(
        config.measurementUploadUrl,
        data: payload,
        cancelToken: cancelToken,
      );
    } on DioException catch (e) {
      timer.cancel();
      stopwatch.stop();
      if (e.type == DioExceptionType.cancel) {
        return ThroughputResult(outcome: ThroughputOutcome.timeout, elapsed: stopwatch.elapsed);
      }
      return ThroughputResult(outcome: ThroughputOutcome.networkError, elapsed: stopwatch.elapsed);
    } catch (_) {
      timer.cancel();
      stopwatch.stop();
      return ThroughputResult(outcome: ThroughputOutcome.networkError, elapsed: stopwatch.elapsed);
    }

    timer.cancel();
    stopwatch.stop();
    return _resultFor(bytesToSend, stopwatch.elapsed, isDownload: false);
  }

  Future<bool> _cellularBlocked(bool allowCellular) async {
    if (allowCellular) return false;
    final results = await _checkConnectivity();
    return results.contains(ConnectivityResult.mobile);
  }

  Future<AppConfig?> _tryFetchConfig() async {
    try {
      return await _configRepository.fetchConfig();
    } catch (_) {
      return null;
    }
  }

  ThroughputResult _resultFor(int bytes, Duration elapsed, {required bool isDownload}) {
    final elapsedMs = elapsed.inMicroseconds / 1000;
    if (bytes <= 0 || elapsedMs <= 0) {
      return ThroughputResult(
        outcome: ThroughputOutcome.budgetExceeded,
        bytesTransferred: bytes,
        elapsed: elapsed,
      );
    }
    final mbps = bytes * 8 / 1e6 / (elapsedMs / 1000);
    return ThroughputResult(
      outcome: ThroughputOutcome.success,
      downloadMbps: isDownload ? mbps : null,
      uploadMbps: isDownload ? null : mbps,
      bytesTransferred: bytes,
      elapsed: elapsed,
    );
  }
}

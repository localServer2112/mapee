import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef ConnectivityChecker = Future<List<ConnectivityResult>> Function();

bool _isOnline(List<ConnectivityResult> results) =>
    results.any((result) => result != ConnectivityResult.none);

/// Wraps `connectivity_plus` (plan §10 Track B Phase 6) behind a single
/// online/offline signal. `connectivity_plus` can only report which network
/// interface is active, not whether it actually reaches the internet — that
/// is this signal's honest ceiling, not a gap to paper over.
class ConnectivityService {
  ConnectivityService({
    Stream<List<ConnectivityResult>>? onConnectivityChanged,
    ConnectivityChecker? checkConnectivity,
  })  : _onConnectivityChanged = onConnectivityChanged ?? Connectivity().onConnectivityChanged,
        _checkConnectivity = checkConnectivity ?? Connectivity().checkConnectivity;

  final Stream<List<ConnectivityResult>> _onConnectivityChanged;
  final ConnectivityChecker _checkConnectivity;

  Stream<bool> get onlineStatus => _onConnectivityChanged.map(_isOnline);

  Future<bool> get isOnlineNow async => _isOnline(await _checkConnectivity());
}

final connectivityServiceProvider = Provider<ConnectivityService>((ref) => ConnectivityService());

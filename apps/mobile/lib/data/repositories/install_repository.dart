import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapee_api/mapee_api.dart';

import '../../app/providers.dart';
import '../api/api_client.dart';
import '../install/install_store.dart';

// Bearer-auth wiring in the generated client (MapeeApi.setBearerAuth /
// BearerAuthInterceptor) is dead code for this API: every generated method's
// `secure` extra is always `[]`, and `v1ScansPost`/`v1MeScansGet` instead
// declare `authorization` as an explicit required header parameter. So the
// token is threaded through as a plain header value, not via setBearerAuth.
class InstallRepository {
  InstallRepository(this._api, this._store);

  final ApiClient _api;
  final InstallStore _store;

  // Mirrors ConfigRepository's single in-flight cache: concurrent callers
  // before the first `_resolve()` completes share the same Future instead of
  // each registering a new install.
  Future<String>? _pending;

  Future<String> ensureInstall() {
    return _pending ??= _resolve();
  }

  Future<String> _resolve() async {
    final stored = await _store.getToken();
    if (stored != null) return stored;

    final response = await _api.installs.v1InstallsPost(
      createInstallRequest: CreateInstallRequest((b) => b.platform = _platform),
    );
    final body = response.data;
    if (body == null) {
      throw StateError('POST /v1/installs returned no body');
    }

    await _store.setToken(body.token);
    return body.token;
  }

  InstallPlatform get _platform {
    if (Platform.isIOS) return InstallPlatform.ios;
    return InstallPlatform.android;
  }
}

final installStoreProvider = Provider<InstallStore>((ref) => InstallStore());

final installRepositoryProvider = Provider<InstallRepository>(
  (ref) => InstallRepository(ref.watch(apiClientProvider), ref.watch(installStoreProvider)),
);

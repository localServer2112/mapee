import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/data/install/install_store.dart';

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  test('getToken returns null when nothing has been stored', () async {
    final store = InstallStore();
    expect(await store.getToken(), isNull);
  });

  test('setToken then getToken round-trips the value', () async {
    final store = InstallStore();
    await store.setToken('abc123');
    expect(await store.getToken(), 'abc123');
  });

  test('uses the well-known storage key so other InstallStore instances see the same token', () async {
    await InstallStore().setToken('shared-token');
    final other = InstallStore();
    expect(await other.getToken(), 'shared-token');
  });
}

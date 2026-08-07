import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_api/mapee_api.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mapee_mobile/app/providers.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/install/install_store.dart';
import 'package:mapee_mobile/data/preferences/settings_preferences.dart';
import 'package:mapee_mobile/data/repositories/install_repository.dart';
import 'package:mapee_mobile/design/primitives/mapee_row.dart';
import 'package:mapee_mobile/features/settings/settings_screen.dart';

class _FakeInstallsApi extends InstallsApi {
  _FakeInstallsApi(this._respond) : super(Dio(), standardSerializers);

  final Future<Response<DeleteMyScansResponse>> Function() _respond;
  int deleteRequestCount = 0;
  String? lastAuthorization;

  @override
  Future<Response<DeleteMyScansResponse>> v1MeScansDelete({
    required String authorization,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    deleteRequestCount++;
    lastAuthorization = authorization;
    return _respond();
  }
}

class _FakeApiClient extends ApiClient {
  _FakeApiClient(this._installsApi);

  final InstallsApi _installsApi;

  @override
  InstallsApi get installs => _installsApi;
}

class _FakeInstallRepository extends InstallRepository {
  _FakeInstallRepository() : super(ApiClient(), InstallStore());

  @override
  Future<String> ensureInstall() async => 'test-token';
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    PackageInfo.setMockInitialValues(
      appName: 'Mapee',
      packageName: 'com.mapee.app',
      version: '1.2.3',
      buildNumber: '45',
      buildSignature: '',
    );
  });

  Future<void> pumpSettings(WidgetTester tester, {List<Override> overrides = const []}) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: overrides,
        child: const CupertinoApp(home: SettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  Finder switchInRowTitled(String title) => find.descendant(
        of: find.ancestor(of: find.text(title), matching: find.byType(MapeeRow)),
        matching: find.byType(CupertinoSwitch),
      );

  testWidgets('renders sections and the real app version', (tester) async {
    await pumpSettings(tester);

    expect(find.text('Imperial units'), findsOneWidget);
    expect(find.text('Data saver'), findsOneWidget);
    expect(find.text('Delete my data'), findsOneWidget);
    expect(find.text('1.2.3 (45)'), findsOneWidget);
  });

  testWidgets('toggling data saver persists to SharedPreferences', (tester) async {
    await pumpSettings(tester);

    await tester.tap(switchInRowTitled('Data saver'));
    await tester.pumpAndSettle();

    final preferences = const SettingsPreferences();
    expect(await preferences.dataSaverEnabled, isTrue);
    expect(tester.widget<CupertinoSwitch>(switchInRowTitled('Data saver')).value, isTrue);
  });

  testWidgets('toggling imperial units persists to SharedPreferences', (tester) async {
    await pumpSettings(tester);

    await tester.tap(switchInRowTitled('Imperial units'));
    await tester.pumpAndSettle();

    final preferences = const SettingsPreferences();
    expect(await preferences.units, DistanceUnits.imperial);
  });

  testWidgets('delete my data confirms, then shows the real deleted count on success', (tester) async {
    final installsApi = _FakeInstallsApi(
      () async => Response<DeleteMyScansResponse>(
        data: DeleteMyScansResponse((b) => b.deletedCount = 3),
        requestOptions: RequestOptions(path: '/v1/me/scans'),
      ),
    );

    await pumpSettings(
      tester,
      overrides: [
        apiClientProvider.overrideWithValue(_FakeApiClient(installsApi)),
        installRepositoryProvider.overrideWithValue(_FakeInstallRepository()),
      ],
    );

    await tester.tap(find.text('Delete my data'));
    await tester.pumpAndSettle();

    expect(find.text('Delete my data?'), findsOneWidget);
    expect(find.text('Delete'), findsOneWidget);

    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();

    expect(find.text('Deleted 3 scans.'), findsOneWidget);
    expect(installsApi.deleteRequestCount, 1);
    expect(installsApi.lastAuthorization, 'Bearer test-token');
  });

  testWidgets('delete my data reports an honest zero-scans outcome, not a generic success', (tester) async {
    final installsApi = _FakeInstallsApi(
      () async => Response<DeleteMyScansResponse>(
        data: DeleteMyScansResponse((b) => b.deletedCount = 0),
        requestOptions: RequestOptions(path: '/v1/me/scans'),
      ),
    );

    await pumpSettings(
      tester,
      overrides: [
        apiClientProvider.overrideWithValue(_FakeApiClient(installsApi)),
        installRepositoryProvider.overrideWithValue(_FakeInstallRepository()),
      ],
    );

    await tester.tap(find.text('Delete my data'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();

    expect(find.text("You don't have any scans to delete."), findsOneWidget);
  });

  testWidgets('delete my data shows an honest failure dialog on a server error, never a false success', (tester) async {
    final installsApi = _FakeInstallsApi(() async {
      final options = RequestOptions(path: '/v1/me/scans');
      throw DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 500),
        type: DioExceptionType.badResponse,
      );
    });

    await pumpSettings(
      tester,
      overrides: [
        apiClientProvider.overrideWithValue(_FakeApiClient(installsApi)),
        installRepositoryProvider.overrideWithValue(_FakeInstallRepository()),
      ],
    );

    await tester.tap(find.text('Delete my data'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();

    expect(
      find.text("Couldn't delete your data right now. Check your connection and try again."),
      findsOneWidget,
    );
    expect(find.textContaining('Deleted'), findsNothing);
  });

  testWidgets('cancelling the delete confirmation never calls the delete endpoint', (tester) async {
    final installsApi = _FakeInstallsApi(
      () async => Response<DeleteMyScansResponse>(
        data: DeleteMyScansResponse((b) => b.deletedCount = 0),
        requestOptions: RequestOptions(path: '/v1/me/scans'),
      ),
    );

    await pumpSettings(
      tester,
      overrides: [
        apiClientProvider.overrideWithValue(_FakeApiClient(installsApi)),
        installRepositoryProvider.overrideWithValue(_FakeInstallRepository()),
      ],
    );

    await tester.tap(find.text('Delete my data'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(installsApi.deleteRequestCount, 0);
    expect(find.text('Deleted 0 scans.'), findsNothing);
    expect(find.text("You don't have any scans to delete."), findsNothing);
  });
}

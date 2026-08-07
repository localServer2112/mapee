import 'package:mapee_api/mapee_api.dart';

import '../../app/env.dart';

/// Thin wrapper over the generated client (plan §2.2 `data/api`) — this is
/// the one place that knows the base URL. Everything else in `data/` and
/// `features/` goes through repositories, never `MapeeApi` directly.
class ApiClient {
  ApiClient({String baseUrl = Env.apiBaseUrl}) : _api = MapeeApi(basePathOverride: baseUrl);

  final MapeeApi _api;

  MapApi get map => _api.getMapApi();
  ConfigApi get config => _api.getConfigApi();
  InsightsApi get insights => _api.getInsightsApi();
  LocationApi get location => _api.getLocationApi();
  ScansApi get scans => _api.getScansApi();
  InstallsApi get installs => _api.getInstallsApi();
}

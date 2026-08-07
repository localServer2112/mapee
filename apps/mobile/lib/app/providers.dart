import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/api_client.dart';
import '../data/repositories/area_repository.dart';
import '../data/repositories/geocode_repository.dart';

/// Plain (non-codegen) Riverpod providers for the Phase 0 vertical slice.
/// The plan's target state is `@riverpod`-annotated providers throughout —
/// deferred here to avoid an extra `build_runner watch` step while the app
/// shell is still this small; migrate incrementally as features grow.
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

final areaRepositoryProvider = Provider<AreaRepository>(
  (ref) => AreaRepository(ref.watch(apiClientProvider)),
);

final geocodeRepositoryProvider = Provider<GeocodeRepository>(
  (ref) => GeocodeRepository(ref.watch(apiClientProvider)),
);

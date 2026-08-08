import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/app/providers.dart';
import 'package:mapee_mobile/data/api/api_client.dart';
import 'package:mapee_mobile/data/repositories/geocode_repository.dart';
import 'package:mapee_mobile/domain/entities/geocode_result.dart';
import 'package:mapee_mobile/features/map/search_pill.dart';

class _FakeGeocodeRepository extends GeocodeRepository {
  _FakeGeocodeRepository(this._results) : super(ApiClient());

  final List<GeocodeLocation> _results;
  int callCount = 0;
  String? lastQuery;

  @override
  Future<List<GeocodeLocation>> search(String query, {String? country}) async {
    callCount++;
    lastQuery = query;
    return _results;
  }
}

Widget _wrap(GeocodeRepository repository, {required void Function(double, double, String) onLocationSelected}) {
  return ProviderScope(
    overrides: [geocodeRepositoryProvider.overrideWithValue(repository)],
    child: CupertinoApp(
      home: SearchPill(onLocationSelected: onLocationSelected),
    ),
  );
}

void main() {
  testWidgets('debounces input before searching, then reports the tapped result', (tester) async {
    final fakeRepo = _FakeGeocodeRepository(const [
      GeocodeLocation(displayName: 'Lagos, Nigeria', lat: 6.5244, lng: 3.3792),
    ]);

    double? selectedLat;
    double? selectedLng;
    String? selectedName;

    await tester.pumpWidget(
      _wrap(
        fakeRepo,
        onLocationSelected: (lat, lng, name) {
          selectedLat = lat;
          selectedLng = lng;
          selectedName = name;
        },
      ),
    );

    await tester.enterText(find.byType(CupertinoTextField), 'Lagos');
    await tester.pump(const Duration(milliseconds: 100));
    expect(fakeRepo.callCount, 0, reason: 'should not search before the debounce window elapses');

    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();

    expect(fakeRepo.callCount, 1);
    expect(fakeRepo.lastQuery, 'Lagos');
    expect(find.text('Lagos, Nigeria'), findsOneWidget);

    await tester.tap(find.text('Lagos, Nigeria'));
    await tester.pump();

    expect(selectedLat, 6.5244);
    expect(selectedLng, 3.3792);
    expect(selectedName, 'Lagos, Nigeria');
  });

  testWidgets('resets the debounce timer on every keystroke, so only the final query is searched', (tester) async {
    final fakeRepo = _FakeGeocodeRepository(const []);

    await tester.pumpWidget(_wrap(fakeRepo, onLocationSelected: (_, _, _) {}));

    await tester.enterText(find.byType(CupertinoTextField), 'La');
    await tester.pump(const Duration(milliseconds: 200));
    await tester.enterText(find.byType(CupertinoTextField), 'Lagos');
    await tester.pump(const Duration(milliseconds: 200));
    expect(fakeRepo.callCount, 0);

    await tester.pump(const Duration(milliseconds: 150));
    await tester.pump();

    expect(fakeRepo.callCount, 1);
    expect(fakeRepo.lastQuery, 'Lagos');
  });

  testWidgets('shows a "no results" state when the search returns nothing', (tester) async {
    final fakeRepo = _FakeGeocodeRepository(const []);

    await tester.pumpWidget(_wrap(fakeRepo, onLocationSelected: (_, _, _) {}));

    await tester.enterText(find.byType(CupertinoTextField), 'Nowhereville');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();

    expect(find.text('No results'), findsOneWidget);
  });

  testWidgets('clears results when the field is emptied', (tester) async {
    final fakeRepo = _FakeGeocodeRepository(const [
      GeocodeLocation(displayName: 'Lagos, Nigeria', lat: 6.5244, lng: 3.3792),
    ]);

    await tester.pumpWidget(_wrap(fakeRepo, onLocationSelected: (_, _, _) {}));

    await tester.enterText(find.byType(CupertinoTextField), 'Lagos');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    expect(find.text('Lagos, Nigeria'), findsOneWidget);

    await tester.enterText(find.byType(CupertinoTextField), '');
    await tester.pump();

    expect(find.text('Lagos, Nigeria'), findsNothing);
    expect(find.text('No results'), findsNothing);
  });
}

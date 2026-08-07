import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_sheet.dart';

Widget _wrap(double textScale, Widget child) {
  return MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: SizedBox(width: 375, child: child),
    ),
  );
}

void main() {
  for (final scale in [1.0, 1.5, 2.0]) {
    testWidgets('MapeeSheet at textScale $scale', (tester) async {
      await tester.pumpWidget(
        _wrap(
          scale,
          const MapeeSheet(
            child: Text('Lagos area', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MapeeSheet),
        matchesGoldenFile('goldens/mapee_sheet_scale_$scale.png'),
      );
    });
  }
}

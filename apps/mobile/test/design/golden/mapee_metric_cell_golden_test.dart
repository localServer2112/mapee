import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_metric_cell.dart';

Widget _wrap(double textScale, Widget child) {
  return MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: ColoredBox(
        color: CupertinoColors.white,
        child: Padding(padding: const EdgeInsets.all(8), child: child),
      ),
    ),
  );
}

void main() {
  for (final scale in [1.0, 1.5, 2.0]) {
    testWidgets('MapeeMetricCell at textScale $scale', (tester) async {
      await tester.pumpWidget(
        _wrap(scale, const MapeeMetricCell(value: '142 ms', label: 'Avg latency')),
      );
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MapeeMetricCell),
        matchesGoldenFile('goldens/mapee_metric_cell_scale_$scale.png'),
      );
    });
  }
}

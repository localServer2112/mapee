import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_row.dart';

Widget _wrap(double textScale, Widget child) {
  return MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: ColoredBox(
        color: CupertinoColors.white,
        child: SizedBox(width: 340, child: child),
      ),
    ),
  );
}

void main() {
  for (final scale in [1.0, 1.5, 2.0]) {
    testWidgets('MapeeRow at textScale $scale', (tester) async {
      await tester.pumpWidget(
        _wrap(
          scale,
          MapeeRow(
            title: 'Units',
            subtitle: 'Metric (Mbps, ms)',
            leading: const Icon(CupertinoIcons.speedometer),
            onTap: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MapeeRow),
        matchesGoldenFile('goldens/mapee_row_scale_$scale.png'),
      );
    });
  }
}

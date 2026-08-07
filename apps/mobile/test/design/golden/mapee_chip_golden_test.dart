import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_chip.dart';

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
    testWidgets('MapeeChip at textScale $scale', (tester) async {
      await tester.pumpWidget(
        _wrap(
          scale,
          const MapeeChip(
            label: 'Excellent',
            icon: CupertinoIcons.checkmark_seal_fill,
            color: CupertinoColors.activeGreen,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MapeeChip),
        matchesGoldenFile('goldens/mapee_chip_scale_$scale.png'),
      );
    });
  }
}

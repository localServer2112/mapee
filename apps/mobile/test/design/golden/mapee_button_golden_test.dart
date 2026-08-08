import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_button.dart';

Widget _wrap(double textScale, Widget child) {
  return MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: ColoredBox(
        color: CupertinoColors.white,
        child: Center(child: SizedBox(width: 300, child: child)),
      ),
    ),
  );
}

void main() {
  for (final scale in [1.0, 1.5, 2.0]) {
    testWidgets('MapeeButton at textScale $scale', (tester) async {
      await tester.pumpWidget(
        _wrap(
          scale,
          MapeeButton(label: 'Run a scan', icon: CupertinoIcons.antenna_radiowaves_left_right, onPressed: () {}),
        ),
      );
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MapeeButton),
        matchesGoldenFile('goldens/mapee_button_scale_$scale.png'),
      );
    });
  }
}

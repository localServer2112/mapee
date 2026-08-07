import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_chip.dart';

void main() {
  testWidgets('renders label and a distinct glyph, not colour alone', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      const CupertinoApp(
        home: MapeeChip(
          label: 'Excellent',
          icon: CupertinoIcons.checkmark_seal_fill,
          color: CupertinoColors.activeGreen,
        ),
      ),
    );

    expect(find.text('Excellent'), findsOneWidget);
    expect(find.byIcon(CupertinoIcons.checkmark_seal_fill), findsOneWidget);
    expect(find.bySemanticsLabel('Excellent'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('renders distinct icon per tier so tiers differ without colour', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: Column(
          children: [
            MapeeChip(label: 'Poor', icon: CupertinoIcons.xmark_seal_fill, color: CupertinoColors.systemRed),
            MapeeChip(label: 'Unknown', icon: CupertinoIcons.question_diamond_fill, color: CupertinoColors.systemGrey),
          ],
        ),
      ),
    );

    expect(find.byIcon(CupertinoIcons.xmark_seal_fill), findsOneWidget);
    expect(find.byIcon(CupertinoIcons.question_diamond_fill), findsOneWidget);
  });
}

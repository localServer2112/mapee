import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_button.dart';

void main() {
  testWidgets('renders label and fires onPressed when tapped', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      CupertinoApp(
        home: MapeeButton(label: 'Run a scan', onPressed: () => tapped = true),
      ),
    );

    expect(find.text('Run a scan'), findsOneWidget);

    await tester.tap(find.byType(MapeeButton));
    await tester.pump();

    expect(tapped, isTrue);
  });

  testWidgets('secondary variant renders and does not fire onPressed when disabled', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: MapeeButton(
          label: 'Adjust location',
          onPressed: null,
          variant: MapeeButtonVariant.secondary,
        ),
      ),
    );

    expect(find.text('Adjust location'), findsOneWidget);

    final button = tester.widget<CupertinoButton>(find.byType(CupertinoButton));
    expect(button.onPressed, isNull);
  });

  testWidgets('renders leading icon when provided', (tester) async {
    await tester.pumpWidget(
      CupertinoApp(
        home: MapeeButton(
          label: 'Share',
          icon: CupertinoIcons.share,
          onPressed: () {},
        ),
      ),
    );

    expect(find.byIcon(CupertinoIcons.share), findsOneWidget);
  });
}

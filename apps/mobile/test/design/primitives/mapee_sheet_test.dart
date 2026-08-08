import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_sheet.dart';

void main() {
  testWidgets('renders child content with a drag grabber', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: MapeeSheet(child: Text('Sheet content')),
      ),
    );

    expect(find.text('Sheet content'), findsOneWidget);

    final grabber = tester.widgetList<Container>(find.byType(Container)).firstWhere(
          (c) => c.constraints?.maxWidth == 36,
        );
    expect(grabber, isNotNull);
  });

  testWidgets('show() opens via showCupertinoModalPopup and fires onPressed to close', (tester) async {
    await tester.pumpWidget(
      CupertinoApp(
        home: Builder(
          builder: (context) => CupertinoButton(
            onPressed: () => MapeeSheet.show<void>(
              context: context,
              builder: (context) => const Text('Opened sheet'),
            ),
            child: const Text('Open'),
          ),
        ),
      ),
    );

    expect(find.text('Opened sheet'), findsNothing);

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(find.text('Opened sheet'), findsOneWidget);
  });
}

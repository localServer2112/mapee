import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_row.dart';

void main() {
  testWidgets('renders title and subtitle', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: MapeeRow(title: 'Notifications', subtitle: 'Scan reminders and alerts'),
      ),
    );

    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Scan reminders and alerts'), findsOneWidget);
  });

  testWidgets('fires onTap and shows a chevron by default when tappable', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      CupertinoApp(
        home: MapeeRow(title: 'Units', onTap: () => tapped = true),
      ),
    );

    expect(find.byIcon(CupertinoIcons.chevron_forward), findsOneWidget);

    await tester.tap(find.byType(MapeeRow));
    await tester.pump();

    expect(tapped, isTrue);
  });

  testWidgets('renders leading and trailing slots', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: MapeeRow(
          title: 'Data usage',
          leading: Icon(CupertinoIcons.chart_bar),
          trailing: Text('42 MB'),
        ),
      ),
    );

    expect(find.byIcon(CupertinoIcons.chart_bar), findsOneWidget);
    expect(find.text('42 MB'), findsOneWidget);
    expect(find.byIcon(CupertinoIcons.chevron_forward), findsNothing);
  });
}

import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mapee_mobile/design/primitives/mapee_metric_cell.dart';
import 'package:mapee_mobile/design/tokens/typography.dart';

void main() {
  testWidgets('renders value with tabular figures and a caption label', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: MapeeMetricCell(value: '142 ms', label: 'Avg latency'),
      ),
    );

    expect(find.text('142 ms'), findsOneWidget);
    expect(find.text('Avg latency'), findsOneWidget);

    final valueText = tester.widget<Text>(find.text('142 ms'));
    expect(valueText.style?.fontFeatures, contains(const FontFeature.tabularFigures()));
    expect(valueText.style?.fontSize, MapeeTypography.metricValue.fontSize);
  });
}

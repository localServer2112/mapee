import 'package:flutter/cupertino.dart';

import '../tokens/colors.dart';
import '../tokens/spacing.dart';

/// Reusable bottom sheet chrome (plan §4.3): rounded top corners at
/// [MapeeSpacing.radiusSheet], a drag grabber, and a [MapeeColors.systemBackground]
/// backdrop. [show] wraps `showCupertinoModalPopup` so callers don't repeat
/// that boilerplate.
class MapeeSheet extends StatelessWidget {
  const MapeeSheet({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  static Future<T?> show<T>({
    required BuildContext context,
    required WidgetBuilder builder,
    bool barrierDismissible = true,
  }) {
    return showCupertinoModalPopup<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (sheetContext) => MapeeSheet(child: builder(sheetContext)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Container(
      padding: padding ??
          const EdgeInsets.fromLTRB(MapeeSpacing.md, MapeeSpacing.sm, MapeeSpacing.md, MapeeSpacing.lg),
      decoration: BoxDecoration(
        color: colors.systemBackground,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(MapeeSpacing.radiusSheet)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 5,
              margin: const EdgeInsets.only(bottom: MapeeSpacing.md),
              decoration: BoxDecoration(
                color: colors.separator,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

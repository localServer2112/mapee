import 'package:flutter/cupertino.dart';

import '../tokens/colors.dart';
import '../tokens/spacing.dart';
import '../tokens/typography.dart';

/// Small chip/badge for quality tiers, ISP tags, and similar labelled facts
/// (plan §4.1). Deliberately generic — callers pass a colour, label, and
/// icon rather than a domain enum, so this same widget serves quality tiers
/// and ISP tags alike.
///
/// Per plan §4.1 rule 1, quality must never be encoded by colour alone: this
/// widget always pairs colour with a text label *and* a distinct glyph, so
/// it survives greyscale and colour-vision deficiency, not just a coloured
/// dot.
class MapeeChip extends StatelessWidget {
  const MapeeChip({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Semantics(
      label: label,
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(MapeeSpacing.radiusControl),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.sm, vertical: MapeeSpacing.xs),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: MapeeSpacing.xs),
              Text(
                label,
                style: MapeeTypography.caption1.copyWith(color: colors.label, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

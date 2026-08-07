import 'package:flutter/cupertino.dart';

import '../tokens/colors.dart';
import '../tokens/spacing.dart';
import '../tokens/typography.dart';

/// Settings/list row primitive (plan §4). Leading slot, title + optional
/// subtitle, trailing slot defaulting to a disclosure chevron when [onTap]
/// is set. Enforces [MapeeSpacing.minHitTarget] as a minimum height.
class MapeeRow extends StatelessWidget {
  const MapeeRow({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.showChevron = true,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    final trailingWidget = trailing ??
        (onTap != null && showChevron
            ? Icon(CupertinoIcons.chevron_forward, size: 18, color: colors.tertiaryLabel)
            : null);

    final row = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: MapeeSpacing.minHitTarget),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.md, vertical: MapeeSpacing.sm),
        child: Row(
          children: [
            if (leading != null) ...[
              leading!,
              const SizedBox(width: MapeeSpacing.md),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: MapeeTypography.body.copyWith(color: colors.label)),
                  if (subtitle != null) ...[
                    const SizedBox(height: MapeeSpacing.xs),
                    Text(
                      subtitle!,
                      style: MapeeTypography.subheadline.copyWith(color: colors.secondaryLabel),
                    ),
                  ],
                ],
              ),
            ),
            if (trailingWidget != null) ...[
              const SizedBox(width: MapeeSpacing.sm),
              trailingWidget,
            ],
          ],
        ),
      ),
    );

    if (onTap == null) return row;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: row,
    );
  }
}

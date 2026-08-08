import 'package:flutter/cupertino.dart';

import '../tokens/colors.dart';
import '../tokens/spacing.dart';
import '../tokens/typography.dart';

enum MapeeButtonVariant { primary, secondary }

/// Primary/secondary action button (plan §4). Primary is filled with
/// [MapeeColors.accent]; secondary is a tinted outline. Both clamp to
/// [MapeeSpacing.minHitTarget] so they never regress below the 44pt HIG
/// minimum the legacy web buttons missed.
class MapeeButton extends StatelessWidget {
  const MapeeButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = MapeeButtonVariant.primary,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final MapeeButtonVariant variant;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    final isPrimary = variant == MapeeButtonVariant.primary;
    final background = isPrimary ? colors.accent : colors.secondaryBackground;
    final foreground = isPrimary ? CupertinoColors.white : colors.accent;

    return CupertinoButton(
      onPressed: onPressed,
      padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.md),
      minimumSize: const Size(MapeeSpacing.minHitTarget, MapeeSpacing.minHitTarget),
      color: background,
      borderRadius: BorderRadius.circular(MapeeSpacing.radiusControl),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MapeeSpacing.minHitTarget),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 20, color: foreground),
              const SizedBox(width: MapeeSpacing.sm),
            ],
            Flexible(
              child: Text(
                label,
                style: MapeeTypography.headline.copyWith(color: foreground),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

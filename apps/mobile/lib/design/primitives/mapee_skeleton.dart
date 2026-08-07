import 'package:flutter/cupertino.dart';
import 'package:shimmer/shimmer.dart';

import '../tokens/colors.dart';
import '../tokens/spacing.dart';

/// A single shimmering placeholder block (plan §10 Track B Phase 6). Compose
/// a few of these per screen to approximate that screen's real layout —
/// this primitive only renders one block, not a whole-screen skeleton.
class MapeeSkeleton extends StatelessWidget {
  const MapeeSkeleton({super.key, required this.height, this.width, this.borderRadius});

  final double height;
  final double? width;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return Shimmer.fromColors(
      baseColor: colors.secondaryBackground,
      highlightColor: colors.tertiaryBackground,
      child: Container(
        height: height,
        width: width,
        decoration: BoxDecoration(
          color: colors.secondaryBackground,
          borderRadius: borderRadius ?? BorderRadius.circular(MapeeSpacing.radiusControl),
        ),
      ),
    );
  }
}

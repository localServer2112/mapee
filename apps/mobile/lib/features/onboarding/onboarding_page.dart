import 'package:flutter/cupertino.dart';

import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';

class OnboardingPage extends StatelessWidget {
  const OnboardingPage({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.lg, vertical: MapeeSpacing.xl),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height * 0.45),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 88, color: colors.accent),
              const SizedBox(height: MapeeSpacing.xl),
              Text(
                title,
                textAlign: TextAlign.center,
                style: MapeeTypography.title2.copyWith(color: colors.label),
              ),
              const SizedBox(height: MapeeSpacing.md),
              Text(
                body,
                textAlign: TextAlign.center,
                style: MapeeTypography.body.copyWith(color: colors.secondaryLabel),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

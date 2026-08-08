import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapee_api/mapee_api.dart';

import '../../design/haptics/haptics.dart';
import '../../design/primitives/mapee_button.dart';
import '../../design/primitives/mapee_row.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import '../../domain/constants.dart';
import '../../domain/entities/isp_detection_result.dart';
import '../../services/network/isp_detector.dart';

const Map<String, ISPName> ispNameByDisplayName = {
  'MTN Nigeria': ISPName.mTNNigeria,
  'Airtel Nigeria': ISPName.airtelNigeria,
  'Globacom (Glo)': ISPName.globacomLeftParenthesisGloRightParenthesis,
  '9mobile': ISPName.n9mobile,
  'Spectranet': ISPName.spectranet,
  'Swift Networks': ISPName.swiftNetworks,
  'ipNX': ISPName.ipNX,
  'Starlink Nigeria': ISPName.starlinkNigeria,
  'Tizeti (wifi.com.ng)': ISPName.tizetiLeftParenthesisWifiPeriodComPeriodNgRightParenthesis,
  'Cyberspace': ISPName.cyberspace,
  'MainOne': ISPName.mainOne,
  'Coollink': ISPName.coollink,
  'Ngcom': ISPName.ngcom,
  'Other': ISPName.other,
};

class IspStep extends ConsumerStatefulWidget {
  const IspStep({super.key, required this.onConfirmed});

  final void Function(ISPName isp) onConfirmed;

  @override
  ConsumerState<IspStep> createState() => _IspStepState();
}

class _IspStepState extends ConsumerState<IspStep> {
  late Future<IspDetectionResult> _future;
  bool _showList = false;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = ref.read(ispDetectorProvider).detect();
  }

  void _confirm(String displayName) {
    final isp = ispNameByDisplayName[displayName];
    if (isp == null) return;
    MapeeHaptics.selectionClick();
    widget.onConfirmed(isp);
  }

  void _chooseDifferent() {
    MapeeHaptics.selectionClick();
    setState(() => _showList = true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(MapeeSpacing.md),
        child: FutureBuilder<IspDetectionResult>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const _LoadingView();
            }

            final detected = snapshot.data!.ispName;
            if (detected != null && !_showList) {
              return _ConfirmView(
                ispDisplayName: detected,
                colors: colors,
                onConfirm: () => _confirm(detected),
                onChooseDifferent: _chooseDifferent,
              );
            }

            return _SearchableList(
              colors: colors,
              query: _query,
              onQueryChanged: (value) => setState(() => _query = value),
              onSelected: _confirm,
            );
          },
        ),
      ),
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return const Center(child: CupertinoActivityIndicator(radius: 14));
  }
}

class _ConfirmView extends StatelessWidget {
  const _ConfirmView({
    required this.ispDisplayName,
    required this.colors,
    required this.onConfirm,
    required this.onChooseDifferent,
  });

  final String ispDisplayName;
  final MapeeColors colors;
  final VoidCallback onConfirm;
  final VoidCallback onChooseDifferent;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Is this your network?',
          textAlign: TextAlign.center,
          style: MapeeTypography.title2.copyWith(color: colors.label),
        ),
        const SizedBox(height: MapeeSpacing.lg),
        Container(
          padding: const EdgeInsets.all(MapeeSpacing.md),
          decoration: BoxDecoration(
            color: colors.secondaryBackground,
            borderRadius: BorderRadius.circular(MapeeSpacing.radiusCard),
          ),
          child: Row(
            children: [
              Icon(CupertinoIcons.antenna_radiowaves_left_right, color: colors.accent),
              const SizedBox(width: MapeeSpacing.md),
              Expanded(
                child: Text(
                  ispDisplayName,
                  style: MapeeTypography.headline.copyWith(color: colors.label),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: MapeeSpacing.lg),
        MapeeButton(label: 'Confirm', onPressed: onConfirm),
        const SizedBox(height: MapeeSpacing.sm),
        MapeeButton(
          label: 'Not this one',
          variant: MapeeButtonVariant.secondary,
          onPressed: onChooseDifferent,
        ),
      ],
    );
  }
}

class _SearchableList extends StatelessWidget {
  const _SearchableList({
    required this.colors,
    required this.query,
    required this.onQueryChanged,
    required this.onSelected,
  });

  final MapeeColors colors;
  final String query;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final normalizedQuery = query.trim().toLowerCase();
    final filtered = normalizedQuery.isEmpty
        ? ispList
        : ispList.where((name) => name.toLowerCase().contains(normalizedQuery)).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Choose your network',
          style: MapeeTypography.title2.copyWith(color: colors.label),
        ),
        const SizedBox(height: MapeeSpacing.md),
        CupertinoSearchTextField(
          placeholder: 'Search networks',
          onChanged: onQueryChanged,
        ),
        const SizedBox(height: MapeeSpacing.sm),
        Expanded(
          child: ListView.separated(
            itemCount: filtered.length,
            separatorBuilder: (context, index) => Container(height: 1, color: colors.separator),
            itemBuilder: (context, index) {
              final name = filtered[index];
              return MapeeRow(
                title: name,
                subtitle: name == 'Other' ? 'Not listed — choose the closest match' : null,
                showChevron: false,
                onTap: () => onSelected(name),
              );
            },
          ),
        ),
      ],
    );
  }
}

import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../design/tokens/colors.dart';
import '../../design/tokens/spacing.dart';
import '../../design/tokens/typography.dart';
import '../../domain/entities/geocode_result.dart';

/// Floating search pill for the map tab (plan §3's "floating search pill").
/// A later integration step places this in `MapScreen`'s `Stack` and wires
/// [onLocationSelected] to move the map camera — this widget itself has no
/// map dependency, only search-as-you-type against `/v1/geocode`.
class SearchPill extends ConsumerStatefulWidget {
  const SearchPill({super.key, required this.onLocationSelected});

  final void Function(double lat, double lng, String displayName) onLocationSelected;

  @override
  ConsumerState<SearchPill> createState() => _SearchPillState();
}

class _SearchPillState extends ConsumerState<SearchPill> {
  static const _debounceDuration = Duration(milliseconds: 300);

  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounce;

  bool _loading = false;
  bool _searched = false;
  List<GeocodeLocation> _results = const [];

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();

    final query = value.trim();
    if (query.isEmpty) {
      setState(() {
        _loading = false;
        _searched = false;
        _results = const [];
      });
      return;
    }

    _debounce = Timer(_debounceDuration, () => _search(query));
  }

  Future<void> _search(String query) async {
    setState(() => _loading = true);

    final results = await ref.read(geocodeRepositoryProvider).search(query);
    if (!mounted) return;

    setState(() {
      _loading = false;
      _searched = true;
      _results = results;
    });
  }

  void _onResultTap(GeocodeLocation result) {
    _debounce?.cancel();
    _focusNode.unfocus();
    setState(() {
      _searched = false;
      _results = const [];
    });
    widget.onLocationSelected(result.lat, result.lng, result.displayName);
  }

  @override
  Widget build(BuildContext context) {
    final colors = MapeeColors.of(context);
    final showDropdown = _loading || _searched;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: MapeeSpacing.minHitTarget,
          padding: const EdgeInsets.symmetric(horizontal: MapeeSpacing.md),
          decoration: BoxDecoration(
            color: colors.secondaryBackground,
            borderRadius: BorderRadius.circular(MapeeSpacing.radiusControl),
            border: Border.all(color: colors.separator),
            boxShadow: [
              BoxShadow(
                color: CupertinoColors.black.withValues(alpha: 0.08),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(CupertinoIcons.search, size: 18, color: colors.secondaryLabel),
              const SizedBox(width: MapeeSpacing.sm),
              Expanded(
                child: CupertinoTextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  onChanged: _onChanged,
                  placeholder: 'Search for a place',
                  placeholderStyle: MapeeTypography.body.copyWith(color: colors.tertiaryLabel),
                  style: MapeeTypography.body.copyWith(color: colors.label),
                  decoration: const BoxDecoration(),
                  padding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        ),
        if (showDropdown) ...[
          const SizedBox(height: MapeeSpacing.xs),
          Container(
            constraints: const BoxConstraints(maxHeight: 280),
            decoration: BoxDecoration(
              color: colors.secondaryBackground,
              borderRadius: BorderRadius.circular(MapeeSpacing.radiusControl),
              border: Border.all(color: colors.separator),
              boxShadow: [
                BoxShadow(
                  color: CupertinoColors.black.withValues(alpha: 0.08),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: _buildDropdownContent(colors),
          ),
        ],
      ],
    );
  }

  Widget _buildDropdownContent(MapeeColors colors) {
    if (_loading) {
      return Padding(
        padding: const EdgeInsets.all(MapeeSpacing.md),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(),
            const SizedBox(width: MapeeSpacing.sm),
            Text('Searching…', style: MapeeTypography.footnote.copyWith(color: colors.secondaryLabel)),
          ],
        ),
      );
    }

    if (_results.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(MapeeSpacing.md),
        child: Text(
          'No results',
          style: MapeeTypography.footnote.copyWith(color: colors.secondaryLabel),
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      itemCount: _results.length,
      separatorBuilder: (context, index) => Container(height: 1, color: colors.separator),
      itemBuilder: (context, index) {
        final result = _results[index];
        return CupertinoButton(
          padding: EdgeInsets.zero,
          borderRadius: BorderRadius.zero,
          onPressed: () => _onResultTap(result),
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(minHeight: MapeeSpacing.minHitTarget),
            padding: const EdgeInsets.symmetric(
              horizontal: MapeeSpacing.md,
              vertical: MapeeSpacing.sm,
            ),
            alignment: Alignment.centerLeft,
            child: Text(
              result.displayName,
              style: MapeeTypography.body.copyWith(color: colors.label),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        );
      },
    );
  }
}

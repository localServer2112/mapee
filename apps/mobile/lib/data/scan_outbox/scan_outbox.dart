import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../repositories/scan_submission_repository.dart';
import 'scan_outbox_entry.dart';

class ScanOutbox {
  ScanOutbox(this._submissionRepository, {SharedPreferences? prefs}) : _prefsOverride = prefs {
    unawaited(_ensureLoaded());
  }

  final ScanSubmissionRepository _submissionRepository;
  final SharedPreferences? _prefsOverride;

  static const _storageKey = 'mapee.scan_outbox.pending';

  // A fixed interval is simpler than exponential backoff and equally correct
  // here: a failed POST just gets retried on the next tick, and the timer
  // itself stops entirely once the queue drains, so there's no unbounded
  // hammering of the server while idle.
  static const retryInterval = Duration(seconds: 30);

  Future<SharedPreferences>? _prefsFuture;
  Future<void>? _loadingFuture;
  bool _loaded = false;
  List<ScanOutboxEntry> _entries = [];
  final Set<String> _inFlight = {};
  Timer? _timer;
  final _controller = StreamController<List<ScanOutboxEntry>>.broadcast();

  List<ScanOutboxEntry> get currentPending => List.unmodifiable(_entries);

  Stream<List<ScanOutboxEntry>> get pending => _controller.stream;

  Future<void> enqueue(ScanOutboxEntry entry) async {
    await _ensureLoaded();
    _entries = [..._entries, entry];
    await _persist();
    _ensureTimer();
    await _attempt(entry.id);
  }

  Future<void> loadPending() => _ensureLoaded();

  Future<void> retryNow() async {
    await _ensureLoaded();
    final ids = _entries.map((e) => e.id).toList();
    for (final id in ids) {
      await _attempt(id);
    }
  }

  Future<void> _attempt(String id) async {
    if (_inFlight.contains(id)) return;
    _inFlight.add(id);
    try {
      final index = _entries.indexWhere((e) => e.id == id);
      if (index == -1) return;
      final entry = _entries[index];
      try {
        await _submissionRepository.submitScan(
          id: entry.id,
          lat: entry.lat,
          lng: entry.lng,
          reportedIsp: entry.reportedIsp,
          verifiedAsn: entry.verifiedAsn,
          latencyMs: entry.latencyMs,
          jitter: entry.jitter,
          uploadSpeed: entry.uploadSpeed,
          downloadSpeed: entry.downloadSpeed,
          measurementMethod: entry.measurementMethod,
          deviceType: entry.deviceType,
          radioType: entry.radioType,
          signalDbm: entry.signalDbm,
          mcc: entry.mcc,
          mnc: entry.mnc,
        );
        _entries = _entries.where((e) => e.id != id).toList();
        await _persist();
        if (_entries.isEmpty) _cancelTimer();
      } catch (_) {
        final failedIndex = _entries.indexWhere((e) => e.id == id);
        if (failedIndex != -1) {
          final updated = List<ScanOutboxEntry>.of(_entries);
          updated[failedIndex] = updated[failedIndex].copyWith(attempts: updated[failedIndex].attempts + 1);
          _entries = updated;
          await _persist();
        }
      }
    } finally {
      _inFlight.remove(id);
    }
  }

  Future<SharedPreferences> _getPrefs() {
    final override = _prefsOverride;
    if (override != null) return Future.value(override);
    return _prefsFuture ??= SharedPreferences.getInstance();
  }

  Future<void> _ensureLoaded() {
    if (_loaded) return Future.value();
    return _loadingFuture ??= _load();
  }

  Future<void> _load() async {
    final prefs = await _getPrefs();
    final raw = prefs.getString(_storageKey);
    if (raw != null) {
      final decoded = jsonDecode(raw) as List<dynamic>;
      _entries = decoded.map((e) => ScanOutboxEntry.fromJson(e as Map<String, dynamic>)).toList();
    }
    _loaded = true;
    _controller.add(currentPending);
    // Resume the periodic retry for anything still pending from a previous
    // run; the next tick (not an immediate attempt) picks it up, keeping
    // restart behavior identical to the ordinary retry path.
    if (_entries.isNotEmpty) _ensureTimer();
  }

  Future<void> _persist() async {
    final prefs = await _getPrefs();
    final raw = jsonEncode(_entries.map((e) => e.toJson()).toList());
    await prefs.setString(_storageKey, raw);
    _controller.add(currentPending);
  }

  void _ensureTimer() {
    _timer ??= Timer.periodic(retryInterval, (_) => retryNow());
  }

  void _cancelTimer() {
    _timer?.cancel();
    _timer = null;
  }

  void dispose() {
    _cancelTimer();
    _controller.close();
  }
}

final scanOutboxProvider = Provider<ScanOutbox>((ref) => ScanOutbox(ref.watch(scanSubmissionRepositoryProvider)));

import '../../domain/entities/my_scan.dart';

const _monthAbbr = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// Hand-rolled date/time formatting — no `intl` dependency in this project
/// (plan §2.2 keeps the dependency list lean), so `timestamp` (Unix ms) is
/// composed into e.g. "Aug 6, 3:42 PM" from plain `DateTime` fields.
String formatScanTimestamp(int timestampMs) {
  final dt = DateTime.fromMillisecondsSinceEpoch(timestampMs).toLocal();
  final month = _monthAbbr[dt.month - 1];
  final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final period = dt.hour >= 12 ? 'PM' : 'AM';
  final minute = dt.minute.toString().padLeft(2, '0');
  return '$month ${dt.day}, $hour12:$minute $period';
}

String scanListSummary(MyScan scan) {
  final when = formatScanTimestamp(scan.timestamp);
  if (!scan.isMeasured) {
    return '$when · ${scan.latencyMs} ms · Heuristic ping';
  }
  return '$when · ${scan.latencyMs} ms · ${scan.downloadMbps.toStringAsFixed(1)} Mbps';
}

String composeScanShareText(MyScan scan) {
  final when = formatScanTimestamp(scan.timestamp);
  final lines = [
    'Mapee network scan',
    scan.ispDisplayName,
    when,
    'Latency: ${scan.latencyMs} ms (jitter ${scan.jitterMs} ms)',
    if (scan.isMeasured) 'Download: ${scan.downloadMbps.toStringAsFixed(1)} Mbps',
    if (scan.isMeasured) 'Upload: ${scan.uploadMbps.toStringAsFixed(1)} Mbps',
    if (!scan.isMeasured) 'Throughput: not measured (heuristic ping)',
  ];
  return lines.join('\n');
}

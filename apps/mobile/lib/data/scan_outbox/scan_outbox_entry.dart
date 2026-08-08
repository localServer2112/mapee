import 'dart:math';

import 'package:mapee_api/mapee_api.dart';

class ScanOutboxEntry {
  const ScanOutboxEntry({
    required this.id,
    required this.lat,
    required this.lng,
    required this.reportedIsp,
    this.verifiedAsn,
    required this.latencyMs,
    required this.jitter,
    required this.uploadSpeed,
    required this.downloadSpeed,
    this.measurementMethod,
    required this.deviceType,
    this.radioType,
    this.signalDbm,
    this.mcc,
    this.mnc,
    required this.createdAt,
    this.attempts = 0,
  });

  // The id doubles as submitScan's `id` param on every retry: the server
  // treats a repeat POST with the same id as an idempotent success rather
  // than a new scan, so it must be generated once here and reused verbatim.
  factory ScanOutboxEntry.create({
    required double lat,
    required double lng,
    required ISPName reportedIsp,
    String? verifiedAsn,
    required int latencyMs,
    required int jitter,
    required double uploadSpeed,
    required double downloadSpeed,
    CreateScanRequestMeasurementMethodEnum? measurementMethod,
    required DeviceType deviceType,
    String? radioType,
    int? signalDbm,
    String? mcc,
    String? mnc,
  }) {
    return ScanOutboxEntry(
      id: _generateId(),
      lat: lat,
      lng: lng,
      reportedIsp: reportedIsp,
      verifiedAsn: verifiedAsn,
      latencyMs: latencyMs,
      jitter: jitter,
      uploadSpeed: uploadSpeed,
      downloadSpeed: downloadSpeed,
      measurementMethod: measurementMethod,
      deviceType: deviceType,
      radioType: radioType,
      signalDbm: signalDbm,
      mcc: mcc,
      mnc: mnc,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
  }

  final String id;
  final double lat;
  final double lng;
  final ISPName reportedIsp;
  final String? verifiedAsn;
  final int latencyMs;
  final int jitter;
  final double uploadSpeed;
  final double downloadSpeed;
  final CreateScanRequestMeasurementMethodEnum? measurementMethod;
  final DeviceType deviceType;
  final String? radioType;
  final int? signalDbm;
  final String? mcc;
  final String? mnc;
  final int createdAt;
  final int attempts;

  ScanOutboxEntry copyWith({int? attempts}) {
    return ScanOutboxEntry(
      id: id,
      lat: lat,
      lng: lng,
      reportedIsp: reportedIsp,
      verifiedAsn: verifiedAsn,
      latencyMs: latencyMs,
      jitter: jitter,
      uploadSpeed: uploadSpeed,
      downloadSpeed: downloadSpeed,
      measurementMethod: measurementMethod,
      deviceType: deviceType,
      radioType: radioType,
      signalDbm: signalDbm,
      mcc: mcc,
      mnc: mnc,
      createdAt: createdAt,
      attempts: attempts ?? this.attempts,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'lat': lat,
        'lng': lng,
        'reportedIsp': reportedIsp.name,
        'verifiedAsn': verifiedAsn,
        'latencyMs': latencyMs,
        'jitter': jitter,
        'uploadSpeed': uploadSpeed,
        'downloadSpeed': downloadSpeed,
        'measurementMethod': measurementMethod?.name,
        'deviceType': deviceType.name,
        'radioType': radioType,
        'signalDbm': signalDbm,
        'mcc': mcc,
        'mnc': mnc,
        'createdAt': createdAt,
        'attempts': attempts,
      };

  static ScanOutboxEntry fromJson(Map<String, dynamic> json) {
    return ScanOutboxEntry(
      id: json['id'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      reportedIsp: ISPName.valueOf(json['reportedIsp'] as String),
      verifiedAsn: json['verifiedAsn'] as String?,
      latencyMs: json['latencyMs'] as int,
      jitter: json['jitter'] as int,
      uploadSpeed: (json['uploadSpeed'] as num).toDouble(),
      downloadSpeed: (json['downloadSpeed'] as num).toDouble(),
      measurementMethod: json['measurementMethod'] != null
          ? CreateScanRequestMeasurementMethodEnum.valueOf(json['measurementMethod'] as String)
          : null,
      deviceType: DeviceType.valueOf(json['deviceType'] as String),
      radioType: json['radioType'] as String?,
      signalDbm: json['signalDbm'] as int?,
      mcc: json['mcc'] as String?,
      mnc: json['mnc'] as String?,
      createdAt: json['createdAt'] as int,
      attempts: json['attempts'] as int? ?? 0,
    );
  }
}

String _generateId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

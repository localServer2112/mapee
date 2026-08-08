/// Plain-Dart mirror of `/v1/config`'s response (plan §7.1: server-owned
/// config so thresholds/endpoints can be tuned without shipping a new
/// mobile binary). No Flutter/generated-client imports.
class AppConfig {
  const AppConfig({
    required this.ispList,
    required this.latencyGoodMs,
    required this.latencyFairMs,
    required this.measurementDownloadUrl,
    required this.measurementUploadUrl,
  });

  final List<String> ispList;
  final int latencyGoodMs;
  final int latencyFairMs;
  final String measurementDownloadUrl;
  final String measurementUploadUrl;
}

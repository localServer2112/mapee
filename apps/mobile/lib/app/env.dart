/// Flavor-driven config (plan Phase 0). Only a `dev` value exists so far —
/// staging/prod flavors and `--dart-define` wiring land with CI (later in
/// Phase 0), once there's a staging apps/api deployment to point at.
class Env {
  const Env._();

  /// apps/api's default dev port (apps/api/src/index.ts). The iOS Simulator
  /// shares the host Mac's network namespace, so 127.0.0.1 would resolve
  /// directly there — but a physical device is a separate machine on the
  /// LAN and can't reach the Mac's loopback at all, so this points at the
  /// Mac's actual LAN IP instead (works from both Simulator and a real
  /// device on the same Wi-Fi network). Update this if testing from a
  /// different network — `ipconfig getifaddr en0` on the Mac.
  static const String apiBaseUrl = 'http://192.168.1.252:8787';

  /// Mapbox's public/default access token — meant to ship inside client
  /// binaries (unlike the backend's service-role-style secrets), scoped and
  /// rate-limited from the Mapbox account dashboard rather than kept truly
  /// secret. Get one at https://account.mapbox.com/access-tokens/ (every
  /// account has a "Default public token" already).
  ///
  /// Not hardcoded here despite being a "public" token: a real, unrestricted
  /// token committed as a literal string is still scrapeable from a public
  /// repo's history and usable against the account's Mapbox quota/billing by
  /// anyone who finds it (confirmed the hard way — GitHub's push protection
  /// blocked exactly this). Supply it at build/run time instead:
  ///   flutter run --dart-define=MAPBOX_ACCESS_TOKEN=pk.xxxx
  /// CI injects it from a repository secret (see .github/workflows/ci.yml).
  static const String mapboxAccessToken = String.fromEnvironment('MAPBOX_ACCESS_TOKEN');
}

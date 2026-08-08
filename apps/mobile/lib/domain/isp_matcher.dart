import 'constants.dart';
import 'entities/asn_info.dart';

/// Normalizes a string for comparison: lowercase, strip everything but
/// letters and digits.
String _normalize(String str) {
  return str.toLowerCase().replaceAll(RegExp('[^a-z0-9]'), '');
}

/// Pattern matching for specific ISPs. Maps keywords found in ASN info to our
/// standardized ISP names (see [ispList]).
const Map<String, String> _ispPatterns = {
  'mtn': 'MTN Nigeria',
  'airtel': 'Airtel Nigeria',
  'glo': 'Globacom (Glo)',
  'globacom': 'Globacom (Glo)',
  '9mobile': '9mobile',
  'emts': '9mobile',
  'etisalat': '9mobile', // Legacy name
  'spectranet': 'Spectranet',
  'swift': 'Swift Networks',
  'ipnx': 'ipNX',
  'starlink': 'Starlink Nigeria',
  'spacex': 'Starlink Nigeria',
  'tizeti': 'Tizeti (wifi.com.ng)',
  'wifi.com.ng': 'Tizeti (wifi.com.ng)',
  'cyberspace': 'Cyberspace',
  'mainone': 'MainOne',
  'coollink': 'Coollink',
  'ngcom': 'Ngcom',
};

/// Detects if the connected network matches a known Nigerian ISP.
///
/// Returns the matching ISP name from [ispList], or null if no match found.
String? detectISP(AsnInfo asnInfo) {
  final sources = [asnInfo.isp, asnInfo.org, asnInfo.asname].where((s) => s.isNotEmpty);

  for (final source in sources) {
    final normalizedSource = _normalize(source);

    // Normalize the pattern too, not just the source: normalize() strips
    // dots, so a pattern like "wifi.com.ng" could never be found in a
    // haystack of "wificomng" if only the source were normalized.
    for (final entry in _ispPatterns.entries) {
      if (normalizedSource.contains(_normalize(entry.key))) {
        return entry.value;
      }
    }
  }

  return null;
}

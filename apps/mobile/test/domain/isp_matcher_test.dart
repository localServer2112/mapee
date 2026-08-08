import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/domain/entities/asn_info.dart';
import 'package:mapee_mobile/domain/isp_matcher.dart';

AsnInfo asn({String isp = '', String as = '', String asname = '', String org = ''}) {
  return AsnInfo(isp: isp, as: as, asname: asname, org: org);
}

void main() {
  group('detectISP', () {
    test('returns null when nothing matches', () {
      expect(detectISP(asn(isp: 'Comcast Cable')), null);
    });

    test('returns null for entirely empty ASN info', () {
      expect(detectISP(asn()), null);
    });

    test('matches the major Nigerian carriers', () {
      expect(detectISP(asn(isp: 'MTN Nigeria Communications')), 'MTN Nigeria');
      expect(detectISP(asn(isp: 'Airtel Networks Limited')), 'Airtel Nigeria');
      expect(detectISP(asn(isp: 'Globacom Limited')), 'Globacom (Glo)');
      expect(detectISP(asn(isp: 'Spectranet Ltd')), 'Spectranet');
    });

    test('normalises case, spacing and punctuation before matching', () {
      expect(detectISP(asn(isp: 'm.t.n  NIGERIA')), 'MTN Nigeria');
      expect(detectISP(asn(org: 'S P E C T R A N E T')), 'Spectranet');
    });

    test("maps 9mobile's legacy and corporate names", () {
      expect(detectISP(asn(isp: 'Etisalat Nigeria')), '9mobile');
      expect(detectISP(asn(isp: 'EMTS Limited')), '9mobile');
      expect(detectISP(asn(isp: '9Mobile')), '9mobile');
    });

    test('maps Starlink via its operating company', () {
      expect(detectISP(asn(org: 'SpaceX Services, Inc.')), 'Starlink Nigeria');
      expect(detectISP(asn(isp: 'Starlink')), 'Starlink Nigeria');
    });

    test('searches org and asname, not just isp', () {
      expect(detectISP(asn(org: 'Globacom Limited')), 'Globacom (Glo)');
      expect(detectISP(asn(asname: 'TIZETI-NETWORK')), 'Tizeti (wifi.com.ng)');
    });

    test('matches Tizeti by its consumer-facing domain', () {
      // The pattern contains dots, which normalisation strips from the
      // haystack -- this asserts the domain form still resolves.
      expect(detectISP(asn(isp: 'wifi.com.ng')), 'Tizeti (wifi.com.ng)');
    });

    test('ignores empty fields without throwing', () {
      expect(detectISP(asn(isp: 'MTN')), 'MTN Nigeria');
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:mapee_mobile/domain/entities/asn_info.dart';
import 'package:mapee_mobile/domain/entities/isp_detection_result.dart';
import 'package:mapee_mobile/services/network/isp_detector.dart';

void main() {
  Future<AsnInfo?> noAsnInfo() async => null;

  test('OS carrier name that matches a known ISP wins without an ASN lookup', () async {
    var asnLookupCalled = false;
    final detector = IspDetector(
      fetchAsnInfo: () async {
        asnLookupCalled = true;
        return null;
      },
      carrierNameProvider: () async => 'MTN NG',
    );

    final result = await detector.detect();

    expect(result.ispName, 'MTN Nigeria');
    expect(result.source, IspDetectionSource.osCarrierName);
    expect(asnLookupCalled, isFalse);
  });

  test('null OS carrier name falls through to the ASN lookup', () async {
    final detector = IspDetector(
      fetchAsnInfo: () async => const AsnInfo(isp: 'Airtel Networks', as: 'AS1', asname: '', org: ''),
      carrierNameProvider: () async => null,
    );

    final result = await detector.detect();

    expect(result.ispName, 'Airtel Nigeria');
    expect(result.source, IspDetectionSource.asnLookup);
  });

  test('unrecognized OS carrier name falls through to the ASN lookup', () async {
    final detector = IspDetector(
      fetchAsnInfo: () async => const AsnInfo(isp: 'Globacom', as: '', asname: '', org: ''),
      carrierNameProvider: () async => 'Some Foreign Carrier',
    );

    final result = await detector.detect();

    expect(result.ispName, 'Globacom (Glo)');
    expect(result.source, IspDetectionSource.asnLookup);
  });

  test('both sources failing yields none', () async {
    final detector = IspDetector(fetchAsnInfo: noAsnInfo, carrierNameProvider: () async => null);

    final result = await detector.detect();

    expect(result.ispName, isNull);
    expect(result.source, IspDetectionSource.none);
  });

  test('unrecognized carrier name and no ASN match yields none', () async {
    final detector = IspDetector(
      fetchAsnInfo: () async => const AsnInfo(isp: 'Unknown Telco', as: '', asname: '', org: ''),
      carrierNameProvider: () async => 'Some Foreign Carrier',
    );

    final result = await detector.detect();

    expect(result.ispName, isNull);
    expect(result.source, IspDetectionSource.none);
  });

  test('default carrier name provider is the no-op stub', () async {
    final detector = IspDetector(
      fetchAsnInfo: () async => const AsnInfo(isp: 'Spectranet', as: '', asname: '', org: ''),
    );

    final result = await detector.detect();

    expect(result.ispName, 'Spectranet');
    expect(result.source, IspDetectionSource.asnLookup);
  });
}

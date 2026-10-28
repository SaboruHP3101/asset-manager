import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/features/asset_depreciations/depreciations_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('reads employee ID only for UI self-approval checks', () async {
    final payload = base64Url
        .encode(utf8.encode(jsonEncode({'sub': 'head-id'})))
        .replaceAll('=', '');
    FlutterSecureStorage.setMockInitialValues({
      'access_token': 'header.$payload.signature',
    });
    expect(
      await DepreciationsRepository(dio: Dio()).currentEmployeeId(),
      'head-id',
    );
  });

  for (final token in [
    null,
    'invalid',
    'header.%.signature',
    'header.e30.signature',
  ]) {
    test('missing or malformed identity stays unavailable: $token', () async {
      FlutterSecureStorage.setMockInitialValues({'access_token': ?token});
      expect(
        await DepreciationsRepository(dio: Dio()).currentEmployeeId(),
        isNull,
      );
    });
  }

  test(
    'uses existing routes, flat responses and exact decision contract',
    () async {
      final dio = Dio();
      final requests = <RequestOptions>[];
      final period = {
        'id': 'period-id',
        'month': '2026-09-01',
        'status': 'draft',
        'assetCount': 2,
        'totalDepreciation': '999999999999999999',
      };
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response(
                requestOptions: options,
                data: options.path.endsWith('/periods') ? [period] : period,
              ),
            );
          },
        ),
      );
      final repository = DepreciationsRepository(dio: dio);
      final periods = await repository.findAll();
      expect(periods.single.assetCount, 2);
      expect(periods.single.total, '999999999999999999');
      await repository.findOne('period-id');
      await repository.recalculate('period-id');
      await repository.submit('period-id');
      await repository.decide('period-id', approve: true);
      await repository.decide('period-id', approve: false, reason: 'Sửa số dư');
      expect(requests.map((request) => '${request.method} ${request.path}'), [
        'GET /asset-depreciations/periods',
        'GET /asset-depreciations/periods/period-id',
        'POST /asset-depreciations/periods/period-id/recalculate',
        'POST /asset-depreciations/periods/period-id/submit',
        'POST /asset-depreciations/periods/period-id/decision',
        'POST /asset-depreciations/periods/period-id/decision',
      ]);
      expect(requests[4].data, {'decision': 'approve'});
      expect(requests[5].data, {'decision': 'return', 'reason': 'Sửa số dư'});
    },
  );
}

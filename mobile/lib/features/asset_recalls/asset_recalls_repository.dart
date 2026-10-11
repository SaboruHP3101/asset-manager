import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';

class AssetRecallsRepository {
  AssetRecallsRepository({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  final Dio _dio;

  Future<Map<String, dynamic>> create({
    required String assetId,
    required String reason,
    String type = 'exchange',
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/asset-recall-requests',
      data: {'type': type, 'assetId': assetId, 'reason': reason},
    );

    return response.data!;
  }

  Future<Map<String, dynamic>> update({
    required String id,
    required String reason,
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/asset-recall-requests/$id',
      data: {'reason': reason},
    );

    return response.data!;
  }

  Future<Map<String, dynamic>> submit(
    String id, {
    bool resubmit = false,
  }) async {
    final action = resubmit ? 'resubmit' : 'submit';
    final response = await _dio.post<Map<String, dynamic>>(
      '/asset-recall-requests/$id/$action',
    );

    return response.data!;
  }

  Future<List<Map<String, dynamic>>> findMine() async {
    final response = await _dio.get<List<dynamic>>(
      '/asset-recall-requests/mine',
    );

    return (response.data ?? const []).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> findQueue() async {
    final response = await _dio.get<List<dynamic>>(
      '/asset-recall-requests/queue',
    );

    return (response.data ?? const []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> findOne(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/asset-recall-requests/$id',
    );

    return response.data!;
  }

  Future<void> decideDepartment(
    String id, {
    required bool approved,
    String? reason,
  }) => _dio.post<void>(
    '/asset-recall-requests/$id/department-decision',
    data: {'approved': approved, 'reason': ?reason},
  );

  Future<void> decideIt(
    String id, {
    required bool approved,
    String? replacementAssetId,
    String? reason,
  }) => _dio.post<void>(
    '/asset-recall-requests/$id/it-decision',
    data: {
      'approved': approved,
      'replacementAssetId': ?replacementAssetId,
      'reason': ?reason,
    },
  );

  Future<void> decideHandover(
    String id, {
    required bool confirmed,
    String? reason,
  }) => _dio.post<void>(
    '/asset-recall-requests/$id/handover-decision',
    data: {'confirmed': confirmed, 'reason': ?reason},
  );

  Future<void> completeDisposal(
    String id, {
    required String disposalDate,
    required String disposalMethod,
    String? processingResult,
    String? recoveryValue,
  }) => _dio.post<void>(
    '/asset-recall-requests/$id/complete-disposal',
    data: {
      'disposalDate': disposalDate,
      'disposalMethod': disposalMethod,
      'processingResult': ?processingResult,
      'recoveryValue': ?recoveryValue,
    },
  );

  Future<void> completeUpgrade(String id, {required String processingResult}) =>
      _dio.post<void>(
        '/asset-recall-requests/$id/complete-upgrade',
        data: {'processingResult': processingResult},
      );

  Future<void> decideUpgradeReturn(
    String id, {
    required bool confirmed,
    String? reason,
  }) => _dio.post<void>(
    '/asset-recall-requests/$id/upgrade-return-decision',
    data: {'confirmed': confirmed, 'reason': ?reason},
  );

  Future<List<Map<String, dynamic>>> findExchangeCandidates() async {
    final response = await _dio.get<List<dynamic>>(
      '/asset-recall-requests/exchange-candidates',
    );

    return (response.data ?? const []).cast<Map<String, dynamic>>();
  }
}

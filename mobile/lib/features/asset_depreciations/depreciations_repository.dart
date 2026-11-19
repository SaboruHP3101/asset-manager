import 'dart:convert';

import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import 'depreciation_models.dart';

class DepreciationsRepository {
  DepreciationsRepository({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  final Dio _dio;
  static const _path = '/asset-depreciations/periods';

  Future<List<DepreciationPeriod>> findAll() async {
    final response = await _dio.get<List<dynamic>>(_path);
    return response.data!
        .map(
          (item) => DepreciationPeriod.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  Future<DepreciationPeriod> findOne(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('$_path/$id');
    return DepreciationPeriod.fromJson(response.data!);
  }

  Future<List<DepreciationPeriod>> generateDuePeriods() async {
    final response = await _dio.post<List<dynamic>>('$_path/generate');
    return response.data!
        .map(
          (item) => DepreciationPeriod.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  Future<DepreciationPeriod> recalculate(String id) => _post(id, 'recalculate');
  Future<DepreciationPeriod> submit(String id) => _post(id, 'submit');
  Future<DepreciationPeriod> decide(
    String id, {
    required bool approve,
    String? reason,
  }) => _post(id, 'decision', {
    'decision': approve ? 'approve' : 'return',
    'reason': ?reason,
  });

  Future<DepreciationPeriod> _post(
    String id,
    String action, [
    Map<String, String>? data,
  ]) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '$_path/$id/$action',
      data: data,
    );
    return DepreciationPeriod.fromJson(response.data!);
  }

  Future<String?> currentEmployeeId() async {
    final token = await TokenStorage.instance.readAccessToken();
    if (token == null) return null;
    // Only controls self-approval visibility; the API verifies identity and permissions.
    final parts = token.split('.');
    if (parts.length != 3) return null;
    try {
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      );
      return payload is Map<String, dynamic> && payload['sub'] is String
          ? payload['sub'] as String
          : null;
    } on FormatException {
      return null;
    }
  }
}

String depreciationError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final message = data['message'];
      if (message is String) return message;
      if (message is List) return message.join('\n');
    }
  }
  return 'Không thể tải hoặc cập nhật khấu hao. Kiểm tra kết nối và thử lại.';
}

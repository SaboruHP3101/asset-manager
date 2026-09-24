import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/api_client.dart';
import 'purchase_request_models.dart';

class PurchaseRequestsRepository {
  PurchaseRequestsRepository({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  final Dio _dio;

  Future<List<PurchaseRequestSummary>> findMine() async {
    final response = await _dio.get<List<dynamic>>('/purchase-requests/mine');
    return response.data!
        .map(
          (item) => PurchaseRequestSummary.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<PurchaseRequestSummary>> findQueue() async {
    final response = await _dio.get<List<dynamic>>('/purchase-requests/queue');
    return response.data!
        .map(
          (item) => PurchaseRequestSummary.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<PurchaseRequestDetail> findOne(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/purchase-requests/$id',
    );
    return PurchaseRequestDetail.fromJson(response.data!);
  }

  Future<List<PurchaseCategoryOption>> categories() async {
    final response = await _dio.get<List<dynamic>>('/asset-categories');
    return response.data!
        .map(
          (item) => PurchaseCategoryOption.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<PurchaseSupplierOption>> suppliers() async {
    final response = await _dio.get<List<dynamic>>('/suppliers');
    return response.data!
        .map(
          (item) => PurchaseSupplierOption.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<PurchaseRequestDetail> save({
    String? id,
    required String neededByDate,
    required String purpose,
    String? note,
    required List<PurchaseRequestItemDraft> items,
  }) async {
    final payload = {
      'neededByDate': neededByDate,
      'purpose': purpose,
      if (note?.isNotEmpty ?? false) 'note': note,
      'items': items.map((item) => item.toJson()).toList(),
    };
    final response = id == null
        ? await _dio.post<Map<String, dynamic>>(
            '/purchase-requests',
            data: payload,
          )
        : await _dio.patch<Map<String, dynamic>>(
            '/purchase-requests/$id',
            data: payload,
          );
    return PurchaseRequestDetail.fromJson(response.data!);
  }

  Future<void> submit(String id) =>
      _dio.post<void>('/purchase-requests/$id/submit');

  Future<void> submitProcurement(String id) =>
      _dio.post<void>('/purchase-requests/$id/submit-procurement');

  Future<void> decide(
    String id,
    String endpoint, {
    required bool approved,
    String? reason,
  }) => _dio.post<void>(
    '/purchase-requests/$id/$endpoint',
    data: {'approved': approved, 'reason': ?reason},
  );

  Future<void> addQuote({
    required String requestId,
    required String requestItemId,
    required String supplierId,
    required String unitPriceExclVat,
    required String vatRate,
    required bool isSelected,
    required XFile image,
    String? note,
  }) async {
    final bytes = await image.readAsBytes();
    final data = FormData.fromMap({
      'requestItemId': requestItemId,
      'supplierId': supplierId,
      'unitPriceExclVat': unitPriceExclVat,
      'vatRate': vatRate,
      'isSelected': isSelected.toString(),
      if (note?.isNotEmpty ?? false) 'note': note,
      'file': MultipartFile.fromBytes(bytes, filename: image.name),
    });
    await _dio.post<void>('/purchase-requests/$requestId/quotes', data: data);
  }
}

String purchaseApiError(Object error) {
  if (error is DioException) {
    final body = error.response?.data;
    if (body is Map && body['message'] != null) {
      final message = body['message'];
      return message is List ? message.join('\n') : message.toString();
    }
    if (error.response?.statusCode == 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (error.response?.statusCode == 403) {
      return 'Bạn không có quyền thực hiện thao tác này.';
    }
  }
  return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}

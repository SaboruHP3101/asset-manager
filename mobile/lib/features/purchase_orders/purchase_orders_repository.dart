import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../purchase_requests/purchase_requests_repository.dart';
import 'purchase_order_models.dart';

class PurchaseOrdersRepository {
  PurchaseOrdersRepository({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  final Dio _dio;

  Future<List<EligiblePurchaseOrderItem>> findEligibleRequests() async {
    final response = await _dio.get<List<dynamic>>(
      '/purchase-orders/eligible-requests',
    );
    return response.data!
        .map(
          (item) => EligiblePurchaseOrderItem.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<PurchaseOrderSummary>> findAll({String? requestId}) async {
    final response = await _dio.get<List<dynamic>>(
      '/purchase-orders',
      queryParameters: {'requestId': ?requestId},
    );
    return _parseSummaries(response.data!);
  }

  Future<List<PurchaseOrderSummary>> findApprovalQueue() async {
    final response = await _dio.get<List<dynamic>>('/purchase-orders/queue');
    return _parseSummaries(response.data!);
  }

  Future<PurchaseOrderDetail> findOne(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/purchase-orders/$id',
    );
    return PurchaseOrderDetail.fromJson(response.data!);
  }

  Future<PurchaseOrderDetail> save({
    String? id,
    required String purchaseRequestId,
    required String supplierId,
    required String orderDate,
    required String expectedDeliveryDate,
    String? contractId,
    required Map<String, int> quantities,
  }) async {
    final payload = {
      'purchaseRequestId': purchaseRequestId,
      'supplierId': supplierId,
      'orderDate': orderDate,
      'expectedDeliveryDate': expectedDeliveryDate,
      if (contractId?.isNotEmpty ?? false) 'contractId': contractId,
      'items': quantities.entries
          .where((entry) => entry.value > 0)
          .map(
            (entry) => {
              'purchaseRequestItemId': entry.key,
              'quantity': entry.value,
            },
          )
          .toList(),
    };
    final response = id == null
        ? await _dio.post<Map<String, dynamic>>(
            '/purchase-orders',
            data: payload,
          )
        : await _dio.patch<Map<String, dynamic>>(
            '/purchase-orders/$id',
            data: payload,
          );
    return PurchaseOrderDetail.fromJson(response.data!);
  }

  Future<void> submit(String id) =>
      _dio.post<void>('/purchase-orders/$id/submit');

  Future<void> decide(String id, {required bool approved, String? reason}) =>
      _dio.post<void>(
        '/purchase-orders/$id/decision',
        data: {'approved': approved, 'reason': ?reason},
      );

  Future<void> cancel(String id, String reason) =>
      _dio.post<void>('/purchase-orders/$id/cancel', data: {'reason': reason});

  List<PurchaseOrderSummary> _parseSummaries(List<dynamic> data) => data
      .map(
        (item) => PurchaseOrderSummary.fromJson(
          Map<String, dynamic>.from(item as Map),
        ),
      )
      .toList();
}

String purchaseOrderApiError(Object error) => purchaseApiError(error);

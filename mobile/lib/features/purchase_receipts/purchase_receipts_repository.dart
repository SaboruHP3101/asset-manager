import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/api_client.dart';
import '../purchase_requests/purchase_requests_repository.dart';
import 'purchase_receipt_models.dart';

class PurchaseReceiptsRepository {
  PurchaseReceiptsRepository({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  final Dio _dio;

  Future<List<PurchaseReceiptProgress>> findOrderProgress(
    String orderId,
  ) async {
    final response = await _dio.get<List<dynamic>>(
      '/purchase-receipts/purchase-orders/$orderId/progress',
    );

    return response.data!
        .map(
          (item) => PurchaseReceiptProgress.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<void> record({
    required String orderId,
    required String deliveryDate,
    required String deliveryNoteNumber,
    required Map<String, int> quantities,
    required Map<String, List<String>> serialNumbers,
    required XFile deliveryNote,
    XFile? invoice,
    XFile? warranty,
  }) async {
    final items = quantities.entries
        .where((entry) => entry.value > 0)
        .map(
          (entry) => {
            'purchaseOrderItemId': entry.key,
            'deliveredQuantity': entry.value,
            if (serialNumbers[entry.key]?.isNotEmpty ?? false)
              'serialNumbers': serialNumbers[entry.key],
          },
        )
        .toList();
    final form = FormData.fromMap({
      'deliveryDate': deliveryDate,
      'deliveryNoteNumber': deliveryNoteNumber,
      'items': jsonEncode(items),
      'deliveryNote': await _imagePart(deliveryNote),
      if (invoice != null) 'invoice': await _imagePart(invoice),
      if (warranty != null) 'warranty': await _imagePart(warranty),
    });

    await _dio.post<void>(
      '/purchase-receipts/purchase-orders/$orderId',
      data: form,
    );
  }

  Future<List<PurchaseInspectionUnit>> findInspectionQueue() async {
    final response = await _dio.get<List<dynamic>>('/purchase-receipts/queue');

    return response.data!
        .map(
          (item) => PurchaseInspectionUnit.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<PurchaseInspectionResult> inspect({
    required String unitId,
    required bool accepted,
    String? reason,
    String? note,
    XFile? evidence,
  }) async {
    final form = FormData.fromMap({
      'accepted': accepted.toString(),
      if (reason?.isNotEmpty ?? false) 'reason': reason,
      if (note?.isNotEmpty ?? false) 'note': note,
      if (evidence != null) 'evidence': await _imagePart(evidence),
    });
    final response = await _dio.post<Map<String, dynamic>>(
      '/purchase-receipts/units/$unitId/inspection',
      data: form,
    );

    return PurchaseInspectionResult.fromJson(response.data!);
  }

  Future<void> closeShort(String orderId, String reason) => _dio.post<void>(
    '/purchase-receipts/purchase-orders/$orderId/close-short',
    data: {'reason': reason},
  );

  Future<MultipartFile> _imagePart(XFile image) async {
    return MultipartFile.fromBytes(
      await image.readAsBytes(),
      filename: image.name,
    );
  }
}

String purchaseReceiptApiError(Object error) => purchaseApiError(error);

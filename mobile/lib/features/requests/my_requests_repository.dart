import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import 'my_requests_data.dart';

class MyRequestsRepository {
  MyRequestsRepository({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  final Dio _dio;

  /// Loads the personal and assigned queues in parallel.
  Future<MyRequestsData> load() async {
    final [mine, queue] = await Future.wait([
      _loadGroup('mine'),
      _loadGroup('queue'),
    ]);
    return MyRequestsData(mine: mine, queue: queue);
  }

  Future<List<MyRequestItem>> _loadGroup(String scope) async {
    final [repairs, recalls, purchases] = await Future.wait([
      _loadItems('/repair-requests/$scope', _repairItem),
      _loadItems('/asset-recall-requests/$scope', _recallItem),
      _loadItems('/purchase-requests/$scope', _purchaseItem),
    ]);
    return [...repairs, ...recalls, ...purchases];
  }

  Future<List<MyRequestItem>> _loadItems(
    String endpoint,
    MyRequestItem Function(Map<String, dynamic>) mapItem,
  ) async {
    final response = await _dio.get<List<dynamic>>(endpoint);
    return [
      for (final raw in response.data ?? const [])
        mapItem(Map<String, dynamic>.from(raw as Map)),
    ];
  }
}

MyRequestItem _repairItem(Map<String, dynamic> json) => MyRequestItem(
  id: json['id'] as String,
  type: MyRequestType.repair,
  title: json['assetName'] as String? ?? 'Tài sản cần sửa chữa',
  reference: json['assetCode'] as String? ?? 'Chưa có mã tài sản',
  status: json['status'] as String? ?? '',
  updatedAt: _parseDate(json['createdAt'] ?? json['reportDate']),
);

MyRequestItem _recallItem(Map<String, dynamic> json) => MyRequestItem(
  id: json['id'] as String,
  type: switch (json['type']) {
    'upgrade' => MyRequestType.upgrade,
    'disposal' => MyRequestType.disposal,
    _ => MyRequestType.exchange,
  },
  title: json['assetName'] as String? ?? 'Tài sản',
  reference: json['assetCode'] as String? ?? 'Chưa có mã tài sản',
  status: json['status'] as String? ?? '',
  updatedAt: _parseDate(json['updatedAt'] ?? json['createdAt']),
);

MyRequestItem _purchaseItem(Map<String, dynamic> json) => MyRequestItem(
  id: json['id'] as String,
  type: MyRequestType.purchase,
  title: 'Đề nghị mua',
  reference: json['requestCode'] as String? ?? 'Chưa có mã phiếu',
  status: json['status'] as String? ?? '',
  updatedAt: _parseDate(json['updatedAt']),
);

DateTime _parseDate(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '') ?? DateTime(1970);

import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../purchase_requests/purchase_requests_repository.dart';
import 'asset_allocation_models.dart';

class AssetAllocationsRepository {
  AssetAllocationsRepository({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  final Dio _dio;

  Future<List<AssetAllocationTask>> findQueue() async {
    final response = await _dio.get<List<dynamic>>('/asset-allocations/queue');

    return response.data!
        .map(
          (item) => AssetAllocationTask.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<AllocationDepartment>> findDepartments() async {
    final response = await _dio.get<List<dynamic>>('/departments');

    return response.data!
        .map(
          (item) => AllocationDepartment.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<AllocationRecipient>> findRecipients(String departmentId) async {
    final response = await _dio.get<List<dynamic>>(
      '/asset-allocations/recipients',
      queryParameters: {'departmentId': departmentId},
    );

    return response.data!
        .map(
          (item) => AllocationRecipient.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<void> allocateBatch({
    required List<AssetAllocationTask> tasks,
    required String targetType,
    String? recipientId,
    required String departmentId,
    required String location,
  }) => _dio.post<void>(
    tasks.first.queueType == 'reallocation'
        ? '/asset-allocations/reallocate/batch'
        : '/asset-allocations/batch',
    data: {
      'assetIds': tasks.map((task) => task.assetId).toList(),
      'targetType': targetType,
      'recipientId': ?recipientId,
      'departmentId': departmentId,
      'location': location,
    },
  );

  Future<void> decideBatch({
    required List<AssetAllocationTask> tasks,
    required bool confirmed,
    String? reason,
  }) => _dio.post(
    '/asset-allocations/batch/${tasks.first.decisionParty}-decision',
    data: {
      'allocationIds': tasks.map((task) => task.allocationId).toList(),
      'confirmed': confirmed,
      if (reason?.isNotEmpty ?? false) 'reason': reason,
    },
  );
}

String assetAllocationApiError(Object error) => purchaseApiError(error);

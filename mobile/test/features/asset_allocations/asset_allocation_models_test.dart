import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/asset_allocations/asset_allocation_models.dart';

void main() {
  test('parses an allocation confirmation task with both decisions', () {
    final task = AssetAllocationTask.fromJson({
      'queueType': 'confirmation',
      'allocationId': 'allocation-1',
      'assetId': 'asset-1',
      'assetCode': 'TS-001',
      'assetName': 'Laptop',
      'recipientName': 'Nguyễn Văn A',
      'location': 'Tầng 3',
      'decisionParty': 'recipient',
      'departmentHeadDecision': 'confirmed',
      'recipientDecision': 'pending',
    });

    expect(task.queueType, 'confirmation');
    expect(task.departmentHeadDecision, 'confirmed');
    expect(task.recipientDecision, 'pending');
    expect(task.decisionParty, 'recipient');
  });

  test('groups allocation work by purchase request with progress', () {
    final tasks = [
      AssetAllocationTask.fromJson({
        'queueType': 'initial',
        'requestId': 'request-1',
        'requestCode': 'PR-2026-001',
        'assetId': 'asset-1',
        'assetCode': 'TS-001',
        'assetName': 'Bàn họp',
        'totalAssets': 3,
        'allocatedAssets': 1,
        'pendingAssets': 2,
      }),
      AssetAllocationTask.fromJson({
        'queueType': 'initial',
        'requestId': 'request-1',
        'requestCode': 'PR-2026-001',
        'assetId': 'asset-2',
        'assetCode': 'TS-002',
        'assetName': 'Ghế họp',
        'totalAssets': 3,
        'allocatedAssets': 1,
        'pendingAssets': 2,
      }),
    ];

    final groups = groupAllocationTasks(tasks);

    expect(groups, hasLength(1));
    expect(groups.single.requestCode, 'PR-2026-001');
    expect(groups.single.tasks, hasLength(2));
    expect(groups.single.progress, closeTo(1 / 3, 0.001));
  });
}

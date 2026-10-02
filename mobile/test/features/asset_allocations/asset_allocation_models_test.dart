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
}

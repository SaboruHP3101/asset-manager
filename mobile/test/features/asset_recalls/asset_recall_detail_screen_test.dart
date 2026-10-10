import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/asset_recalls/asset_recall_detail_screen.dart';
import 'package:mobile/features/asset_recalls/asset_recalls_repository.dart';

class _FakeRepository extends AssetRecallsRepository {
  _FakeRepository() : super(dio: Dio());

  @override
  Future<Map<String, dynamic>> findOne(String id) async => {
    'id': id,
    'status': 'pending_handover_confirmations',
    'reason': 'Máy không còn đáp ứng công việc',
    'departmentHeadDecision': 'confirmed',
    'itHeadDecision': 'confirmed',
    'employeeHandoverDecision': 'confirmed',
    'itHandoverDecision': 'pending',
    'allowedActions': const <String>[],
    'asset': {
      'id': 'old-asset',
      'assetCode': 'TS001',
      'name': 'MacBook Pro 2020',
      'category': 'Laptop',
    },
    'replacementAsset': {
      'id': 'new-asset',
      'assetCode': 'TS002',
      'name': 'MacBook Pro 2024',
      'category': 'Laptop',
    },
    'requester': {'id': 'employee-id', 'name': 'Nguyễn Văn A'},
    'department': {'id': 'department-id', 'name': 'IT'},
    'trail': [
      {
        'actionType': 'asset.recall.submitted',
        'reason': null,
        'createdAt': '2026-10-07T03:00:00.000Z',
      },
    ],
  };
}

void main() {
  testWidgets('hiển thị trạng thái, approval và so sánh tài sản', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AssetRecallDetailScreen(
          requestId: 'recall-id',
          repository: _FakeRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chờ xác nhận bàn giao'), findsOneWidget);
    expect(find.text('Tiến trình phê duyệt'), findsOneWidget);
    expect(find.text('1/2'), findsOneWidget);
    expect(find.text('Tài sản thu hồi'), findsOneWidget);
    expect(find.text('Tài sản thay thế'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Nhân viên đã gửi phiếu'),
      400,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Nhân viên đã gửi phiếu'), findsOneWidget);
  });
}

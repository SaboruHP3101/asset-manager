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

class _DisposalRepository extends AssetRecallsRepository {
  _DisposalRepository() : super(dio: Dio());

  bool completed = false;

  @override
  Future<Map<String, dynamic>> findOne(String id) async => {
    'id': id,
    'type': 'disposal',
    'status': completed ? 'completed' : 'in_progress',
    'reason': 'Thiết bị hỏng, không còn khả năng sử dụng',
    'departmentHeadDecision': 'confirmed',
    'itHeadDecision': 'confirmed',
    'employeeHandoverDecision': 'confirmed',
    'itHandoverDecision': 'confirmed',
    'allowedActions': completed
        ? const <String>[]
        : const ['asset.recall.complete_disposal'],
    'asset': {
      'id': 'old-asset',
      'assetCode': 'TS001',
      'name': 'Laptop hỏng',
      'category': 'Laptop',
    },
    'replacementAsset': null,
    'requester': {'id': 'employee-id', 'name': 'Nguyễn Văn A'},
    'department': {'id': 'department-id', 'name': 'IT'},
    'trail': const <Map<String, dynamic>>[],
  };

  @override
  Future<void> completeDisposal(
    String id, {
    required String disposalDate,
    required String disposalMethod,
    String? processingResult,
    String? recoveryValue,
  }) async {
    completed = disposalMethod == 'Bàn giao xử lý rác điện tử';
  }
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

  testWidgets('Trưởng IT hoàn tất báo phế', (tester) async {
    final repository = _DisposalRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: AssetRecallDetailScreen(
          requestId: 'recall-id',
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Tài sản báo phế'), findsOneWidget);
    expect(find.text('Đang xử lý báo phế'), findsOneWidget);
    await tester.tap(find.text('Hoàn tất báo phế'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Phương thức xử lý *'),
      'Bàn giao xử lý rác điện tử',
    );
    await tester.pump();
    await tester.tap(find.text('Hoàn tất').last);
    await tester.pumpAndSettle();

    expect(repository.completed, isTrue);
    expect(find.text('Đã hoàn tất'), findsOneWidget);
  });

  testWidgets('nhân viên thấy đã bàn giao khi không còn action', (
    tester,
  ) async {
    final repository = _DisposalRepository()..completed = true;
    final request = await repository.findOne('recall-id');
    request['status'] = 'in_progress';
    request['allowedActions'] = const <String>[];

    await tester.pumpWidget(
      MaterialApp(
        home: AssetRecallDetailScreen(
          requestId: 'recall-id',
          repository: _StaticRepository(request),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đã bàn giao'), findsOneWidget);
    expect(find.text('Bạn đã hoàn tất bàn giao.'), findsOneWidget);
  });
}

class _StaticRepository extends AssetRecallsRepository {
  _StaticRepository(this.request) : super(dio: Dio());

  final Map<String, dynamic> request;

  @override
  Future<Map<String, dynamic>> findOne(String id) async => request;
}

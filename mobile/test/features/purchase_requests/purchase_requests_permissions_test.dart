import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_requests/purchase_request_models.dart';
import 'package:mobile/features/purchase_requests/purchase_requests_repository.dart';
import 'package:mobile/features/purchase_requests/purchase_requests_screen.dart';

class _FakeRepository extends PurchaseRequestsRepository {
  _FakeRepository() : super(dio: Dio());

  int queueCalls = 0;

  @override
  Future<List<PurchaseRequestSummary>> findMine() async => const [];

  @override
  Future<List<PurchaseRequestSummary>> findQueue() async {
    queueCalls += 1;
    return const [];
  }
}

void main() {
  testWidgets('nhân viên thường không thấy màn và nút nghiệp vụ chuyên môn', (
    tester,
  ) async {
    final repository = _FakeRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseRequestsScreen(
          repository: repository,
          allowedActions: const {
            'purchase.request.create',
            'purchase.request.update',
            'purchase.request.submit',
            'purchase.allocation.confirm_recipient',
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Của tôi'), findsOneWidget);
    expect(find.text('Chờ xử lý'), findsNothing);
    expect(find.byTooltip('Tải lại'), findsNothing);
    expect(find.text('Tạo đề nghị'), findsOneWidget);
    expect(repository.queueCalls, 0);
  });

  testWidgets('Trưởng phòng thấy hàng chờ xử lý nhưng không thấy PO', (
    tester,
  ) async {
    final repository = _FakeRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseRequestsScreen(
          repository: repository,
          allowedActions: const {
            'purchase.request.create',
            'purchase.request.approve_department',
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chờ xử lý'), findsOneWidget);
    expect(find.byTooltip('Đơn đặt mua'), findsNothing);
    expect(repository.queueCalls, 1);
  });

  testWidgets('nhân viên Thu mua chỉ thấy tab đề nghị liên quan', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseRequestsScreen(
          repository: _FakeRepository(),
          allowedActions: const {
            'purchase.request.create',
            'purchase.request.enrich_procurement',
            'purchase.order.create',
            'purchase.receipt.record',
            'purchase.receipt.inspect_procurement',
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chờ xử lý'), findsOneWidget);
    expect(find.byTooltip('Đơn đặt mua'), findsNothing);
    expect(find.byTooltip('Hàng chờ kiểm tra'), findsNothing);
  });
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_orders/purchase_order_models.dart';
import 'package:mobile/features/purchase_orders/purchase_orders_repository.dart';
import 'package:mobile/features/purchase_orders/purchase_orders_screen.dart';

class _FakeRepository extends PurchaseOrdersRepository {
  _FakeRepository() : super(dio: Dio());

  @override
  Future<List<EligiblePurchaseOrderItem>> findEligibleRequests() async =>
      const [];

  @override
  Future<List<PurchaseOrderSummary>> findAll({String? requestId}) async =>
      const [];

  @override
  Future<List<PurchaseOrderSummary>> findApprovalQueue() async => const [];
}

void main() {
  testWidgets('nhân viên Thu mua không thấy tab duyệt của Trưởng phòng', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrdersScreen(
          repository: _FakeRepository(),
          allowedActions: const {
            'purchase.order.create',
            'purchase.order.submit',
            'purchase.receipt.record',
            'purchase.receipt.inspect_procurement',
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Cần xử lý'), findsOneWidget);
    expect(find.text('Đang thực hiện'), findsOneWidget);
    expect(find.text('Tất cả'), findsOneWidget);
    expect(find.byTooltip('Hàng chờ kiểm tra'), findsNothing);
  });

  testWidgets('Trưởng Thu mua dùng chung tab cần xử lý', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrdersScreen(
          repository: _FakeRepository(),
          allowedActions: const {
            'purchase.order.create',
            'purchase.order.approve',
            'purchase.receipt.record',
            'purchase.receipt.inspect_procurement',
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Cần xử lý'), findsOneWidget);
    expect(find.text('Đang thực hiện'), findsOneWidget);
    expect(find.text('Tất cả'), findsOneWidget);
  });
}

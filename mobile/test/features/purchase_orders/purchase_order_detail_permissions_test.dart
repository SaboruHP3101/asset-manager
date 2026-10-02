import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_orders/purchase_order_detail_screen.dart';
import 'package:mobile/features/purchase_orders/purchase_order_models.dart';
import 'package:mobile/features/purchase_orders/purchase_orders_repository.dart';

class _FakeRepository extends PurchaseOrdersRepository {
  _FakeRepository(this.detail) : super(dio: Dio());

  final PurchaseOrderDetail detail;

  @override
  Future<PurchaseOrderDetail> findOne(String id) async => detail;
}

PurchaseOrderDetail _detail(List<String> allowedActions) => PurchaseOrderDetail(
  id: 'order-id',
  status: 'draft',
  allowedActions: allowedActions,
  purchaseOrderCode: 'PO-2026-TEST',
  purchaseRequestId: 'request-id',
  requestCode: 'PR-2026-TEST',
  supplierId: 'supplier-id',
  supplierName: 'Nhà cung cấp',
  orderDate: '2026-10-02',
  expectedDeliveryDate: '2026-10-15',
  items: const [],
  totals: const {'subtotalExclVat': '0', 'vatAmount': '0', 'totalInclVat': '0'},
  timeline: const [],
);

void main() {
  testWidgets('chi tiết PO chỉ hiện action API cho phép', (tester) async {
    final detail = _detail(const [
      'purchase.order.create',
      'purchase.order.submit',
      'purchase.order.cancel',
    ]);

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrderDetailScreen(
          orderId: detail.id,
          repository: _FakeRepository(detail),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chỉnh sửa'), findsOneWidget);
    expect(find.text('Trình duyệt'), findsOneWidget);
    expect(find.text('Ghi nhận giao hàng'), findsNothing);
    expect(find.byTooltip('Thêm hành động'), findsOneWidget);

    await tester.tap(find.byTooltip('Thêm hành động'));
    await tester.pumpAndSettle();
    expect(find.text('Hủy đơn mua'), findsOneWidget);
    expect(find.text('Đóng thiếu'), findsNothing);
  });

  testWidgets('chi tiết PO không hiện thanh action khi không có quyền', (
    tester,
  ) async {
    final detail = _detail(const []);

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrderDetailScreen(
          orderId: detail.id,
          repository: _FakeRepository(detail),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chỉnh sửa'), findsNothing);
    expect(find.text('Trình duyệt'), findsNothing);
    expect(find.byTooltip('Thêm hành động'), findsNothing);
  });
}

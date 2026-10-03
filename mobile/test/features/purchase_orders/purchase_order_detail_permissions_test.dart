import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_orders/purchase_order_detail_screen.dart';
import 'package:mobile/features/purchase_orders/purchase_order_models.dart';
import 'package:mobile/features/purchase_orders/purchase_orders_repository.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipt_models.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipts_repository.dart';

class _FakeRepository extends PurchaseOrdersRepository {
  _FakeRepository(this.detail) : super(dio: Dio());

  final PurchaseOrderDetail detail;

  @override
  Future<PurchaseOrderDetail> findOne(String id) async => detail;
}

class _ActionRepository extends PurchaseOrdersRepository {
  _ActionRepository({required this.initial, required this.refresh})
    : super(dio: Dio());

  final PurchaseOrderDetail initial;
  final Completer<PurchaseOrderDetail> refresh;
  int findOneCalls = 0;

  @override
  Future<PurchaseOrderDetail> findOne(String id) {
    findOneCalls += 1;
    return findOneCalls == 1 ? Future.value(initial) : refresh.future;
  }

  @override
  Future<void> decide(
    String id, {
    required bool approved,
    String? reason,
  }) async {}
}

class _ReceiptsRepository extends PurchaseReceiptsRepository {
  _ReceiptsRepository() : super(dio: Dio());

  @override
  Future<List<PurchaseReceiptProgress>> findOrderProgress(
    String orderId,
  ) async {
    return const [];
  }
}

PurchaseOrderDetail _detail(
  List<String> allowedActions, {
  String status = 'draft',
  List<Map<String, dynamic>> timeline = const [],
}) => PurchaseOrderDetail(
  id: 'order-id',
  status: status,
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
  timeline: timeline,
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

  testWidgets('action hiển thị loader rồi dùng allowedActions mới nhất', (
    tester,
  ) async {
    final refresh = Completer<PurchaseOrderDetail>();
    final repository = _ActionRepository(
      initial: _detail(const [
        'purchase.order.approve',
      ], status: 'pending_procurement_head'),
      refresh: refresh,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrderDetailScreen(
          orderId: 'order-id',
          repository: repository,
          receiptsRepository: _ReceiptsRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Xử lý đơn mua'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Duyệt'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));

    expect(find.byKey(const Key('po-action-loader')), findsOneWidget);

    refresh.complete(
      _detail(
        const ['purchase.receipt.record'],
        status: 'issued',
        timeline: const [
          {
            'actionType': 'purchase.order.approve',
            'previousStatus': 'pending_procurement_head',
            'newStatus': 'issued',
          },
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Duyệt và phát hành'), findsOneWidget);
    expect(find.text('Xử lý đơn mua'), findsNothing);
    final receiptButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Ghi nhận giao hàng'),
    );
    expect(receiptButton.onPressed, isNotNull);
  });
}

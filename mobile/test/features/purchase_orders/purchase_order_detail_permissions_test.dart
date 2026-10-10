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
  bool? decisionApproved;
  String? decisionReason;

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
  }) async {
    decisionApproved = approved;
    decisionReason = reason;
  }
}

class _SubmitRepository extends PurchaseOrdersRepository {
  _SubmitRepository({required this.initial, required this.refreshed})
    : super(dio: Dio());

  final PurchaseOrderDetail initial;
  final PurchaseOrderDetail refreshed;
  int submitCalls = 0;

  @override
  Future<PurchaseOrderDetail> findOne(String id) async =>
      submitCalls == 0 ? initial : refreshed;

  @override
  Future<void> submit(String id) async {
    submitCalls += 1;
  }
}

class _OverflowActionRepository extends PurchaseOrdersRepository {
  _OverflowActionRepository({required this.initial, required this.refreshed})
    : super(dio: Dio());

  final PurchaseOrderDetail initial;
  final PurchaseOrderDetail refreshed;
  int findOneCalls = 0;
  String? cancellationReason;

  @override
  Future<PurchaseOrderDetail> findOne(String id) async {
    findOneCalls += 1;

    return findOneCalls == 1 ? initial : refreshed;
  }

  @override
  Future<void> cancel(String id, String reason) async {
    cancellationReason = reason;
  }
}

class _ReceiptsRepository extends PurchaseReceiptsRepository {
  _ReceiptsRepository() : super(dio: Dio());

  String? closeShortReason;

  @override
  Future<List<PurchaseReceiptProgress>> findOrderProgress(
    String orderId,
  ) async {
    return const [];
  }

  @override
  Future<void> closeShort(String orderId, String reason) async {
    closeShortReason = reason;
  }
}

PurchaseOrderDetail _detail(
  List<String> allowedActions, {
  String status = 'draft',
  List<Map<String, dynamic>> items = const [],
  Map<String, dynamic> totals = const {
    'subtotalExclVat': '0',
    'vatAmount': '0',
    'totalInclVat': '0',
  },
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
  items: items,
  totals: totals,
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

  testWidgets('trình duyệt chỉ gọi API sau khi xác nhận review', (
    tester,
  ) async {
    final initial = _detail(
      const ['purchase.order.submit'],
      items: const [
        {'itemNameSnapshot': 'Laptop Dell', 'quantity': 2},
      ],
      totals: const {
        'subtotalExclVat': '20000000',
        'vatAmount': '2000000',
        'totalInclVat': '22000000',
      },
    );
    final repository = _SubmitRepository(
      initial: initial,
      refreshed: _detail(
        const [],
        status: 'pending_procurement_head',
        items: initial.items,
        totals: initial.totals,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrderDetailScreen(
          orderId: initial.id,
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Trình duyệt'));
    await tester.pumpAndSettle();

    expect(find.text('Kiểm tra trước khi trình duyệt'), findsOneWidget);
    expect(find.text('Laptop Dell'), findsWidgets);
    expect(find.text('Tổng cộng: 22.000.000 VND'), findsWidgets);
    expect(repository.submitCalls, 0);

    await tester.tap(find.text('Quay lại kiểm tra'));
    await tester.pumpAndSettle();
    expect(repository.submitCalls, 0);

    await tester.tap(find.text('Trình duyệt'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận trình duyệt'));
    await tester.pumpAndSettle();

    expect(repository.submitCalls, 1);
    expect(find.text('Chờ Trưởng Thu mua'), findsOneWidget);
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
    expect(find.byType(BottomSheet), findsOneWidget);
    expect(find.byType(AlertDialog), findsNothing);
    await tester.tap(find.text('Duyệt và phát hành'));
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

  testWidgets('lý do trả về được nhập trong cùng bottom sheet', (tester) async {
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
    await tester.tap(find.text('Trả về chỉnh sửa'));
    await tester.pumpAndSettle();

    expect(find.byType(BottomSheet), findsOneWidget);
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.text('Lý do bắt buộc'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Cần chỉnh lại số lượng');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Xác nhận trả về'));
    await tester.tap(find.text('Xác nhận trả về'));
    await tester.pump();

    expect(repository.decisionApproved, isFalse);
    expect(repository.decisionReason, 'Cần chỉnh lại số lượng');

    refresh.complete(_detail(const ['purchase.order.create']));
    await tester.pumpAndSettle();
  });

  testWidgets('đóng thiếu từ menu không gây lỗi lifecycle', (tester) async {
    final repository = _OverflowActionRepository(
      initial: _detail(const [
        'purchase.receipt.close_short',
      ], status: 'partially_received'),
      refreshed: _detail(const [], status: 'closed_short'),
    );
    final receiptsRepository = _ReceiptsRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrderDetailScreen(
          orderId: 'order-id',
          repository: repository,
          receiptsRepository: receiptsRepository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Thêm hành động'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đóng thiếu'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Nhà cung cấp giao thiếu');
    await tester.tap(find.widgetWithText(FilledButton, 'Xác nhận'));
    await tester.pumpAndSettle();

    expect(receiptsRepository.closeShortReason, 'Nhà cung cấp giao thiếu');
    expect(tester.takeException(), isNull);
  });

  testWidgets('hủy đơn mua từ menu không gây lỗi lifecycle', (tester) async {
    final repository = _OverflowActionRepository(
      initial: _detail(const ['purchase.order.cancel']),
      refreshed: _detail(const [], status: 'cancelled'),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrderDetailScreen(
          orderId: 'order-id',
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Thêm hành động'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hủy đơn mua'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Không còn nhu cầu');
    await tester.tap(find.widgetWithText(FilledButton, 'Xác nhận'));
    await tester.pumpAndSettle();

    expect(repository.cancellationReason, 'Không còn nhu cầu');
    expect(tester.takeException(), isNull);
  });
}

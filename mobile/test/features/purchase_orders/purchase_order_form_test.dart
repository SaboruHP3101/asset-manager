import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/purchase_orders/purchase_order_form.dart';
import 'package:mobile/features/purchase_orders/purchase_order_models.dart';
import 'package:mobile/features/purchase_orders/purchase_orders_repository.dart';

class _FakeRepository extends PurchaseOrdersRepository {
  _FakeRepository() : super(dio: Dio());

  Map<String, int>? savedQuantities;
  String? savedId;
  bool? submittedForApproval;

  @override
  Future<PurchaseOrderDetail> save({
    String? id,
    required String purchaseRequestId,
    required String supplierId,
    required String orderDate,
    required String expectedDeliveryDate,
    String? contractId,
    required Map<String, int> quantities,
    bool submitForApproval = false,
  }) async {
    savedId = id;
    savedQuantities = quantities;
    submittedForApproval = submitForApproval;
    return _draft;
  }

  @override
  Future<List<EligiblePurchaseOrderItem>> findEligibleRequests() async => [
    const EligiblePurchaseOrderItem(
      requestId: 'request-id',
      requestCode: 'PR-2026-002',
      itemId: 'laptop-id',
      itemName: 'Laptop Dell Latitude',
      remainingQuantity: 5,
      supplierId: 'supplier-id',
      supplierName: 'Nhà cung cấp An Khang',
    ),
    const EligiblePurchaseOrderItem(
      requestId: 'request-id',
      requestCode: 'PR-2026-002',
      itemId: 'monitor-id',
      itemName: 'Màn hình 24 inch',
      remainingQuantity: 3,
      supplierId: 'supplier-id',
      supplierName: 'Nhà cung cấp An Khang',
    ),
  ];
}

const _draft = PurchaseOrderDetail(
  id: 'draft-id',
  status: 'draft',
  allowedActions: [],
  purchaseOrderCode: 'PO-1',
  purchaseRequestId: 'request-id',
  requestCode: 'PR-2026-002',
  supplierId: 'supplier-id',
  supplierName: 'Nhà cung cấp An Khang',
  orderDate: '2026-10-02',
  expectedDeliveryDate: '2026-10-15',
  items: [
    {'purchaseRequestItemId': 'laptop-id', 'quantity': 2},
    {
      'purchaseRequestItemId': 'old-item',
      'quantity': 4,
      'itemNameSnapshot': 'Hạng mục đã giữ',
    },
  ],
  totals: {},
  timeline: [],
);

void main() {
  testWidgets('editing restores eligibility for existing and reserved items', (
    tester,
  ) async {
    final repository = _FakeRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrderFormScreen(repository: repository, initial: _draft),
      ),
    );
    await tester.pumpAndSettle();
    final list = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Còn có thể đặt: 7'),
      200,
      scrollable: list,
    );
    expect(find.text('Còn có thể đặt: 7'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Còn có thể đặt: 4'),
      200,
      scrollable: list,
    );
    expect(find.text('Còn có thể đặt: 4'), findsOneWidget);
    await tester.tap(find.text('Lưu nháp'));
    await tester.pumpAndSettle();

    expect(repository.savedId, 'draft-id');
    expect(repository.submittedForApproval, isFalse);
    expect(repository.savedQuantities, {
      'laptop-id': 2,
      'monitor-id': 0,
      'old-item': 4,
    });
  });

  testWidgets('hướng dẫn chọn nhà cung cấp trước khi hiển thị hạng mục', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: PurchaseOrderFormScreen(
          repository: _FakeRepository(),
          initialRequestId: 'request-id',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Thông tin đơn mua'), findsOneWidget);
    expect(find.text('PR-2026-002'), findsOneWidget);
    expect(
      find.text('Chọn nhà cung cấp để xem các hạng mục có thể đặt mua.'),
      findsOneWidget,
    );

    final saveButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Lưu nháp'),
    );
    expect(saveButton.onPressed, isNull);
  });

  testWidgets('chọn hạng mục cập nhật tóm tắt và cho phép lưu', (tester) async {
    final repository = _FakeRepository();
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: PurchaseOrderFormScreen(
          repository: repository,
          initialRequestId: 'request-id',
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nhà cung cấp An Khang').last);
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Laptop Dell Latitude'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Còn có thể đặt: 5'), findsOneWidget);

    await tester.drag(find.byType(ListView), const Offset(0, -180));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Checkbox).first);
    await tester.pump();

    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.text('1 hạng mục · Tổng số lượng: 1'), findsOneWidget);
    final saveButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Lưu nháp'),
    );
    expect(saveButton.onPressed, isNotNull);
    await tester.tap(find.text('Gửi duyệt'));
    await tester.pumpAndSettle();
    expect(repository.submittedForApproval, isNull);
    await tester.tap(find.text('Quay lại kiểm tra'));
    await tester.pumpAndSettle();
    expect(repository.submittedForApproval, isNull);
    await tester.tap(find.text('Gửi duyệt'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận gửi duyệt'));
    await tester.pumpAndSettle();
    expect(repository.submittedForApproval, isTrue);
    expect(repository.savedId, isNull);
    expect(repository.savedQuantities?['laptop-id'], 1);
  });
}

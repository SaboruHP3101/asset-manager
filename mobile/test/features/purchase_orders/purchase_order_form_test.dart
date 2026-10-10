import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_orders/purchase_order_form.dart';
import 'package:mobile/features/purchase_orders/purchase_order_models.dart';
import 'package:mobile/features/purchase_orders/purchase_orders_repository.dart';

class _FakeRepository extends PurchaseOrdersRepository {
  _FakeRepository() : super(dio: Dio());

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

void main() {
  testWidgets('hướng dẫn chọn nhà cung cấp trước khi hiển thị hạng mục', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
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
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseOrderFormScreen(
          repository: _FakeRepository(),
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
  });
}

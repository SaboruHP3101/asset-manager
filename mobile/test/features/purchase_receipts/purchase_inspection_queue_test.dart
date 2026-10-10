import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_receipts/purchase_inspection_queue_screen.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipt_models.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipts_repository.dart';

class _FakeRepository extends PurchaseReceiptsRepository {
  _FakeRepository() : super(dio: Dio());

  @override
  Future<List<PurchaseInspectionUnit>> findInspectionQueue() async => const [
    PurchaseInspectionUnit(
      unitId: 'unit-id',
      receiptId: 'receipt-id',
      receiptCode: 'RC-001',
      deliveryDate: '2026-10-10',
      purchaseOrderId: 'order-id',
      purchaseOrderCode: 'PO-001',
      itemName: 'Laptop Dell',
      trackingMode: 'individual_asset',
      sequenceNumber: 1,
      serialNumber: 'QR-001',
    ),
  ];
}

void main() {
  testWidgets('quét mã mở đúng đơn vị hàng chờ kiểm tra', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseInspectionQueueScreen(
          repository: _FakeRepository(),
          scanner: (
            context, {
            required title,
            required targetCount,
            required initialCodes,
          }) async => ['QR-001'],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Quét mã sản phẩm'));
    await tester.pumpAndSettle();

    expect(find.byType(BottomSheet), findsOneWidget);
    expect(find.text('Mã sản phẩm: QR-001'), findsOneWidget);
    expect(find.text('Xác nhận đạt'), findsOneWidget);
    expect(find.text('Ghi nhận không đạt'), findsOneWidget);
  });

  testWidgets('mã không thuộc hàng chờ kiểm tra hiển thị thông báo', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseInspectionQueueScreen(
          repository: _FakeRepository(),
          scanner: (
            context, {
            required title,
            required targetCount,
            required initialCodes,
          }) async => ['QR-KHONG-TON-TAI'],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Quét mã sản phẩm'));
    await tester.pump();

    expect(
      find.text('Mã không thuộc danh sách hàng chờ kiểm tra.'),
      findsOneWidget,
    );
  });
}

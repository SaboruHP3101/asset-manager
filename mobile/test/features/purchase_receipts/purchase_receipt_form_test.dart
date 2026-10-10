import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipt_form.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipt_models.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipts_repository.dart';

class _FakeRepository extends PurchaseReceiptsRepository {
  _FakeRepository() : super(dio: Dio());

  @override
  Future<List<PurchaseReceiptProgress>> findOrderProgress(
    String orderId,
  ) async => const [
    PurchaseReceiptProgress(
      purchaseOrderItemId: 'item-id',
      itemName: 'Laptop Dell',
      trackingMode: 'individual_asset',
      managementOwner: 'it',
      ordered: 2,
      delivered: 0,
      accepted: 0,
      rejected: 0,
      pending: 0,
      remaining: 2,
    ),
  ];
}

void main() {
  testWidgets('quét số phiếu giao hàng', (tester) async {
    String? scannerTitle;
    var scannedTargetCount = 0;
    List<String>? scannedInitialCodes;

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseReceiptFormScreen(
          orderId: 'order-id',
          repository: _FakeRepository(),
          scanner:
              (
                context, {
                required title,
                required targetCount,
                required initialCodes,
              }) async {
                scannerTitle = title;
                scannedTargetCount = targetCount;
                scannedInitialCodes = initialCodes;
                return ['DELIVERY-001'];
              },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Quét số phiếu giao hàng'));
    await tester.pumpAndSettle();

    expect(scannerTitle, 'Quét số phiếu giao hàng');
    expect(scannedTargetCount, 1);
    expect(scannedInitialCodes, isEmpty);
    final deliveryNoteField = tester.widget<TextFormField>(
      find.byKey(const ValueKey('delivery-note-number')),
    );
    expect(deliveryNoteField.controller!.text, 'DELIVERY-001');
  });

  testWidgets('quét mã sản phẩm theo số lượng giao', (tester) async {
    var scannedTargetCount = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseReceiptFormScreen(
          orderId: 'order-id',
          repository: _FakeRepository(),
          scanner:
              (
                context, {
                required title,
                required targetCount,
                required initialCodes,
              }) async {
                scannedTargetCount = targetCount;
                return ['QR-001', 'QR-002'];
              },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('receipt-quantity-item-id')),
      '2',
    );
    await tester.tap(find.byTooltip('Quét mã Laptop Dell'));
    await tester.pumpAndSettle();

    expect(scannedTargetCount, 2);
    expect(find.text('Đã có 2/2 mã'), findsOneWidget);
    final serialField = tester.widget<TextFormField>(
      find.byKey(const ValueKey('receipt-serials-item-id')),
    );
    expect(serialField.controller!.text, 'QR-001\nQR-002');
  });
}

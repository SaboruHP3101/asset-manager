import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipt_form.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipt_models.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipts_repository.dart';

class _FakeRepository extends PurchaseReceiptsRepository {
  _FakeRepository({this.onlyCompleted = false}) : super(dio: Dio());

  final bool onlyCompleted;

  @override
  Future<List<PurchaseReceiptProgress>> findOrderProgress(
    String orderId,
  ) async => [
    if (!onlyCompleted)
      const PurchaseReceiptProgress(
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
    const PurchaseReceiptProgress(
      purchaseOrderItemId: 'completed-id',
      itemName: 'HP PC',
      trackingMode: 'individual_asset',
      managementOwner: 'it',
      ordered: 1,
      delivered: 1,
      accepted: 0,
      rejected: 0,
      pending: 1,
      remaining: 0,
    ),
  ];
}

void main() {
  testWidgets('chỉ nhập số lượng cho hạng mục còn có thể giao', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseReceiptFormScreen(
          orderId: 'order-id',
          repository: _FakeRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('HP PC'), findsNothing);
    final quantity = find.byKey(const ValueKey('receipt-quantity-item-id'));
    final submit = find.widgetWithText(FilledButton, 'Ghi nhận đợt giao');
    expect(tester.widget<FilledButton>(submit).onPressed, isNull);
    await tester.enterText(quantity, '1');
    await tester.pump();
    expect(tester.widget<FilledButton>(submit).onPressed, isNotNull);
    await tester.enterText(quantity, '0');
    await tester.pump();
    expect(tester.widget<FilledButton>(submit).onPressed, isNull);
  });

  testWidgets('hiện thông báo nếu đơn đã được giao đủ khi mở form', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseReceiptFormScreen(
          orderId: 'order-id',
          repository: _FakeRepository(onlyCompleted: true),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Không còn số lượng có thể giao.'), findsOneWidget);
    expect(find.byType(FilledButton), findsNothing);
  });

  testWidgets('quét số phiếu giao hàng', (tester) async {
    String? scannerTitle;
    var scannedTargetCount = 0;
    List<String>? scannedInitialCodes;

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
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
        theme: buildAppTheme(),
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

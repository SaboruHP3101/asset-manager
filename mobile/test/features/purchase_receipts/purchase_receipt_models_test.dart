import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipt_models.dart';

void main() {
  test('parse tiến độ giao nhận với đủ số lượng kiểm tra', () {
    final progress = PurchaseReceiptProgress.fromJson({
      'purchaseOrderItemId': 'item-1',
      'itemName': 'Laptop',
      'trackingMode': 'individual_asset',
      'managementOwner': 'it',
      'ordered': 5,
      'delivered': 4,
      'accepted': 2,
      'rejected': 1,
      'pending': 1,
      'remaining': 2,
    });

    expect(progress.itemName, 'Laptop');
    expect(progress.pending, 1);
    expect(progress.remaining, 2);
  });

  test('parse kết quả kiểm tra và asset do server tạo', () {
    final result = PurchaseInspectionResult.fromJson({
      'unitId': 'unit-1',
      'inspectionResult': 'accepted',
      'asset': {'assetCode': 'AST-2026-ABC', 'qrCode': 'asset:id'},
    });

    expect(result.assetCode, 'AST-2026-ABC');
    expect(result.qrCode, 'asset:id');
  });
}

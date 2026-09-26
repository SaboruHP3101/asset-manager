import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_orders/purchase_order_models.dart';

void main() {
  test('detail chỉ dùng allowedActions do backend trả về', () {
    final detail = PurchaseOrderDetail.fromJson({
      'id': 'order-id',
      'status': 'issued',
      'allowedActions': ['purchase.order.cancel'],
      'timeline': <dynamic>[],
      'data': {
        'purchaseOrderCode': 'PO-2026-TEST',
        'purchaseRequestId': 'request-id',
        'requestCode': 'PR-2026-TEST',
        'supplierId': 'supplier-id',
        'supplierName': 'Nhà cung cấp A',
        'orderDate': '2026-09-24',
        'expectedDeliveryDate': '2026-10-01',
        'contractId': null,
        'cancellationReason': null,
        'items': <dynamic>[],
        'totals': {
          'subtotalExclVat': '1000000',
          'vatAmount': '80000',
          'totalInclVat': '1080000',
        },
      },
    });

    expect(detail.allows('purchase.order.cancel'), isTrue);
    expect(detail.allows('purchase.order.create'), isFalse);
    expect(purchaseOrderStatusLabel(detail.status), 'Đã phát hành');
  });

  test('eligible item giữ quantity còn lại do backend tính', () {
    final item = EligiblePurchaseOrderItem.fromJson({
      'id': 'request-id',
      'requestCode': 'PR-2026-TEST',
      'itemId': 'item-id',
      'itemName': 'Laptop',
      'remainingQuantity': 2,
      'supplierId': 'supplier-id',
      'supplierName': 'Nhà cung cấp A',
    });

    expect(item.remainingQuantity, 2);
    expect(item.supplierName, 'Nhà cung cấp A');
  });
}

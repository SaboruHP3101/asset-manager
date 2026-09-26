/// Một dòng hạng mục còn có thể đưa vào PO, đã gắn supplier từ báo giá được chọn.
class EligiblePurchaseOrderItem {
  const EligiblePurchaseOrderItem({
    required this.requestId,
    required this.requestCode,
    required this.itemId,
    required this.itemName,
    required this.remainingQuantity,
    required this.supplierId,
    required this.supplierName,
  });

  factory EligiblePurchaseOrderItem.fromJson(Map<String, dynamic> json) {
    return EligiblePurchaseOrderItem(
      requestId: json['id'] as String,
      requestCode: json['requestCode'] as String,
      itemId: json['itemId'] as String,
      itemName: json['itemName'] as String,
      remainingQuantity: json['remainingQuantity'] as int,
      supplierId: json['supplierId'] as String,
      supplierName: json['supplierName'] as String,
    );
  }

  final String requestId;
  final String requestCode;
  final String itemId;
  final String itemName;
  final int remainingQuantity;
  final String supplierId;
  final String supplierName;
}

class PurchaseOrderSummary {
  const PurchaseOrderSummary({
    required this.id,
    required this.purchaseOrderCode,
    required this.purchaseRequestId,
    required this.requestCode,
    required this.supplierName,
    required this.status,
    required this.orderDate,
    required this.expectedDeliveryDate,
  });

  factory PurchaseOrderSummary.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderSummary(
      id: json['id'] as String,
      purchaseOrderCode: json['purchaseOrderCode'] as String,
      purchaseRequestId: json['purchaseRequestId'] as String,
      requestCode: json['requestCode'] as String,
      supplierName: json['supplierName'] as String,
      status: json['status'] as String,
      orderDate: json['orderDate'] as String,
      expectedDeliveryDate: json['expectedDeliveryDate'] as String,
    );
  }

  final String id;
  final String purchaseOrderCode;
  final String purchaseRequestId;
  final String requestCode;
  final String supplierName;
  final String status;
  final String orderDate;
  final String expectedDeliveryDate;
}

class PurchaseOrderDetail {
  const PurchaseOrderDetail({
    required this.id,
    required this.status,
    required this.allowedActions,
    required this.purchaseOrderCode,
    required this.purchaseRequestId,
    required this.requestCode,
    required this.supplierId,
    required this.supplierName,
    required this.orderDate,
    required this.expectedDeliveryDate,
    required this.items,
    required this.totals,
    required this.timeline,
    this.contractId,
    this.cancellationReason,
  });

  factory PurchaseOrderDetail.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map);
    return PurchaseOrderDetail(
      id: json['id'] as String,
      status: json['status'] as String,
      allowedActions: List<String>.from(json['allowedActions'] as List),
      purchaseOrderCode: data['purchaseOrderCode'] as String,
      purchaseRequestId: data['purchaseRequestId'] as String,
      requestCode: data['requestCode'] as String,
      supplierId: data['supplierId'] as String,
      supplierName: data['supplierName'] as String,
      orderDate: data['orderDate'] as String,
      expectedDeliveryDate: data['expectedDeliveryDate'] as String,
      contractId: data['contractId'] as String?,
      cancellationReason: data['cancellationReason'] as String?,
      items: (data['items'] as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
      totals: Map<String, dynamic>.from(data['totals'] as Map),
      timeline: (json['timeline'] as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
    );
  }

  final String id;
  final String status;
  final List<String> allowedActions;
  final String purchaseOrderCode;
  final String purchaseRequestId;
  final String requestCode;
  final String supplierId;
  final String supplierName;
  final String orderDate;
  final String expectedDeliveryDate;
  final String? contractId;
  final String? cancellationReason;
  final List<Map<String, dynamic>> items;
  final Map<String, dynamic> totals;
  final List<Map<String, dynamic>> timeline;

  bool allows(String action) => allowedActions.contains(action);
}

String purchaseOrderStatusLabel(String status) => switch (status) {
  'draft' => 'Nháp',
  'pending_procurement_head' => 'Chờ Trưởng Thu mua',
  'issued' => 'Đã phát hành',
  'partially_received' => 'Đã nhận một phần',
  'fully_received' => 'Đã nhận đủ',
  'closed_short' => 'Đóng thiếu',
  'cancelled' => 'Đã hủy',
  _ => status,
};

String purchaseOrderHistoryLabel(String action) => switch (action) {
  'purchase.order.create' => 'Tạo đơn đặt mua',
  'purchase.order.update' => 'Cập nhật đơn đặt mua',
  'purchase.order.submit' => 'Trình Trưởng Thu mua',
  'purchase.order.approve' => 'Duyệt và phát hành',
  'purchase.order.reject' => 'Trả về chỉnh sửa',
  'purchase.order.cancel' => 'Hủy đơn đặt mua',
  _ => action,
};

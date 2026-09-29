class PurchaseReceiptProgress {
  const PurchaseReceiptProgress({
    required this.purchaseOrderItemId,
    required this.itemName,
    required this.trackingMode,
    required this.managementOwner,
    required this.ordered,
    required this.delivered,
    required this.accepted,
    required this.rejected,
    required this.pending,
    required this.remaining,
  });

  factory PurchaseReceiptProgress.fromJson(Map<String, dynamic> json) {
    return PurchaseReceiptProgress(
      purchaseOrderItemId: json['purchaseOrderItemId'] as String,
      itemName: json['itemName'] as String,
      trackingMode: json['trackingMode'] as String,
      managementOwner: json['managementOwner'] as String,
      ordered: json['ordered'] as int,
      delivered: json['delivered'] as int,
      accepted: json['accepted'] as int,
      rejected: json['rejected'] as int,
      pending: json['pending'] as int,
      remaining: json['remaining'] as int,
    );
  }

  final String purchaseOrderItemId;
  final String itemName;
  final String trackingMode;
  final String managementOwner;
  final int ordered;
  final int delivered;
  final int accepted;
  final int rejected;
  final int pending;
  final int remaining;
}

class PurchaseInspectionUnit {
  const PurchaseInspectionUnit({
    required this.unitId,
    required this.receiptId,
    required this.receiptCode,
    required this.deliveryDate,
    required this.purchaseOrderId,
    required this.purchaseOrderCode,
    required this.itemName,
    required this.trackingMode,
    required this.sequenceNumber,
    this.serialNumber,
  });

  factory PurchaseInspectionUnit.fromJson(Map<String, dynamic> json) {
    return PurchaseInspectionUnit(
      unitId: json['unitId'] as String,
      receiptId: json['receiptId'] as String,
      receiptCode: json['receiptCode'] as String,
      deliveryDate: json['deliveryDate'] as String,
      purchaseOrderId: json['purchaseOrderId'] as String,
      purchaseOrderCode: json['purchaseOrderCode'] as String,
      itemName: json['itemName'] as String,
      trackingMode: json['trackingMode'] as String,
      sequenceNumber: json['sequenceNumber'] as int,
      serialNumber: json['serialNumber'] as String?,
    );
  }

  final String unitId;
  final String receiptId;
  final String receiptCode;
  final String deliveryDate;
  final String purchaseOrderId;
  final String purchaseOrderCode;
  final String itemName;
  final String trackingMode;
  final int sequenceNumber;
  final String? serialNumber;
}

class PurchaseInspectionResult {
  const PurchaseInspectionResult({
    required this.unitId,
    required this.inspectionResult,
    this.assetCode,
    this.qrCode,
  });

  factory PurchaseInspectionResult.fromJson(Map<String, dynamic> json) {
    final asset = json['asset'] == null
        ? null
        : Map<String, dynamic>.from(json['asset'] as Map);

    return PurchaseInspectionResult(
      unitId: json['unitId'] as String,
      inspectionResult: json['inspectionResult'] as String,
      assetCode: asset?['assetCode'] as String?,
      qrCode: asset?['qrCode'] as String?,
    );
  }

  final String unitId;
  final String inspectionResult;
  final String? assetCode;
  final String? qrCode;
}

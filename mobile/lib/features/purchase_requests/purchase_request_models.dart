class PurchaseRequestSummary {
  const PurchaseRequestSummary({
    required this.id,
    required this.requestCode,
    required this.status,
    required this.revision,
    this.requesterName,
  });

  factory PurchaseRequestSummary.fromJson(Map<String, dynamic> json) {
    return PurchaseRequestSummary(
      id: json['id'] as String,
      requestCode: json['requestCode'] as String,
      status: json['status'] as String,
      revision: json['revision'] as int,
      requesterName: json['requesterName'] as String?,
    );
  }

  final String id;
  final String requestCode;
  final String status;
  final int revision;
  final String? requesterName;
}

class PurchaseCategoryOption {
  const PurchaseCategoryOption({required this.id, required this.name});

  factory PurchaseCategoryOption.fromJson(Map<String, dynamic> json) {
    return PurchaseCategoryOption(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }

  final String id;
  final String name;
}

class PurchaseSupplierOption {
  const PurchaseSupplierOption({required this.id, required this.name});

  factory PurchaseSupplierOption.fromJson(Map<String, dynamic> json) {
    return PurchaseSupplierOption(
      id: json['id'] as String,
      name: (json['legalName'] ?? json['tradeName']) as String,
    );
  }

  final String id;
  final String name;
}

class PurchaseRequestItemDraft {
  const PurchaseRequestItemDraft({
    required this.assetCategoryId,
    required this.itemName,
    required this.specifications,
    required this.quantity,
    this.purpose,
  });

  factory PurchaseRequestItemDraft.fromJson(Map<String, dynamic> json) {
    return PurchaseRequestItemDraft(
      assetCategoryId: json['assetCategoryId'] as String,
      itemName: json['itemName'] as String,
      specifications: json['specifications'] as String,
      quantity: json['quantity'] as int,
      purpose: json['purpose'] as String?,
    );
  }

  final String assetCategoryId;
  final String itemName;
  final String specifications;
  final int quantity;
  final String? purpose;

  Map<String, dynamic> toJson() => {
    'assetCategoryId': assetCategoryId,
    'itemName': itemName,
    'specifications': specifications,
    'quantity': quantity,
    if (purpose?.isNotEmpty ?? false) 'purpose': purpose,
  };
}

class PurchaseRequestDetail {
  const PurchaseRequestDetail({
    required this.id,
    required this.status,
    required this.revision,
    required this.pendingAction,
    required this.allowedActions,
    required this.requestCode,
    required this.neededByDate,
    required this.purpose,
    required this.items,
    required this.timeline,
    this.note,
    this.returnReason,
  });

  factory PurchaseRequestDetail.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map);
    final revisionData = Map<String, dynamic>.from(data['revision'] as Map);
    return PurchaseRequestDetail(
      id: json['id'] as String,
      status: json['status'] as String,
      revision: json['revision'] as int,
      pendingAction: json['pendingAction'] as String?,
      allowedActions: List<String>.from(json['allowedActions'] as List),
      requestCode: data['requestCode'] as String,
      neededByDate: revisionData['neededByDate'] as String,
      purpose: revisionData['purpose'] as String,
      note: revisionData['note'] as String?,
      returnReason: revisionData['returnReason'] as String?,
      items: (data['items'] as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
      timeline: (json['timeline'] as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
    );
  }

  final String id;
  final String status;
  final int revision;
  final String? pendingAction;
  final List<String> allowedActions;
  final String requestCode;
  final String neededByDate;
  final String purpose;
  final String? note;
  final String? returnReason;
  final List<Map<String, dynamic>> items;
  final List<Map<String, dynamic>> timeline;

  bool allows(String action) => allowedActions.contains(action);
}

String purchaseStatusLabel(String status) => switch (status) {
  'draft' => 'Nháp',
  'pending_department_head' => 'Chờ Trưởng phòng',
  'pending_procurement_enrichment' => 'Chờ Thu mua bổ sung',
  'pending_procurement_head' => 'Chờ Trưởng Thu mua',
  'pending_it_head' => 'Chờ Trưởng IT',
  'revision_required' => 'Cần điều chỉnh',
  'approved' => 'Đã duyệt',
  'ordering' => 'Đang đặt mua',
  'fully_ordered' => 'Đã đặt đủ',
  _ => status,
};

String purchaseHistoryActionLabel(String actionType) => switch (actionType) {
  'purchase.request.create' => 'Tạo đề nghị',
  'purchase.request.update' => 'Cập nhật đề nghị',
  'purchase.request.submit' => 'Gửi trình duyệt',
  'purchase.request.approve_department' => 'Duyệt cấp phòng',
  'purchase.request.add_quote' => 'Thêm báo giá',
  'purchase.request.submit_procurement' => 'Trình Trưởng Thu mua',
  'purchase.request.approve_procurement' => 'Duyệt thương mại',
  'purchase.request.approve_it' => 'Duyệt chuyên môn IT',
  'purchase.request.reject' => 'Trả về điều chỉnh',
  _ => actionType,
};

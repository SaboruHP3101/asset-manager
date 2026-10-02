class AssetAllocationTask {
  const AssetAllocationTask({
    required this.queueType,
    required this.assetId,
    required this.assetCode,
    required this.assetName,
    this.allocationId,
    this.requestCode,
    this.requestDepartmentId,
    this.departmentId,
    this.recipientName,
    this.location,
    this.decisionParty,
    this.departmentHeadDecision,
    this.recipientDecision,
  });

  factory AssetAllocationTask.fromJson(Map<String, dynamic> json) =>
      AssetAllocationTask(
        queueType: json['queueType'] as String,
        assetId: json['assetId'] as String,
        assetCode: json['assetCode'] as String,
        assetName: json['assetName'] as String? ?? 'Tài sản',
        allocationId: json['allocationId'] as String?,
        requestCode: json['requestCode'] as String?,
        requestDepartmentId: json['requestDepartmentId'] as String?,
        departmentId: json['departmentId'] as String?,
        recipientName: json['recipientName'] as String?,
        location: json['location'] as String?,
        decisionParty: json['decisionParty'] as String?,
        departmentHeadDecision: json['departmentHeadDecision'] as String?,
        recipientDecision: json['recipientDecision'] as String?,
      );

  final String queueType;
  final String assetId;
  final String assetCode;
  final String assetName;
  final String? allocationId;
  final String? requestCode;
  final String? requestDepartmentId;
  final String? departmentId;
  final String? recipientName;
  final String? location;
  final String? decisionParty;
  final String? departmentHeadDecision;
  final String? recipientDecision;
}

class AllocationDepartment {
  const AllocationDepartment({required this.id, required this.name});

  factory AllocationDepartment.fromJson(Map<String, dynamic> json) =>
      AllocationDepartment(
        id: json['id'] as String,
        name: json['name'] as String,
      );

  final String id;
  final String name;
}

class AllocationRecipient {
  const AllocationRecipient({required this.id, required this.fullName});

  factory AllocationRecipient.fromJson(Map<String, dynamic> json) =>
      AllocationRecipient(
        id: json['id'] as String,
        fullName: json['fullName'] as String,
      );

  final String id;
  final String fullName;
}

class AssetAllocationTask {
  const AssetAllocationTask({
    required this.queueType,
    required this.assetId,
    required this.assetCode,
    required this.assetName,
    this.requestId,
    this.allocationId,
    this.requestCode,
    this.requestDepartmentId,
    this.departmentId,
    this.recipientName,
    this.location,
    this.decisionParty,
    this.departmentHeadDecision,
    this.recipientDecision,
    this.targetType,
    this.totalAssets = 0,
    this.allocatedAssets = 0,
    this.pendingAssets = 0,
  });

  factory AssetAllocationTask.fromJson(Map<String, dynamic> json) =>
      AssetAllocationTask(
        queueType: json['queueType'] as String,
        assetId: json['assetId'] as String,
        assetCode: json['assetCode'] as String,
        assetName: json['assetName'] as String? ?? 'Tài sản',
        requestId: json['requestId'] as String?,
        allocationId: json['allocationId'] as String?,
        requestCode: json['requestCode'] as String?,
        requestDepartmentId: json['requestDepartmentId'] as String?,
        departmentId: json['departmentId'] as String?,
        recipientName: json['recipientName'] as String?,
        location: json['location'] as String?,
        decisionParty: json['decisionParty'] as String?,
        departmentHeadDecision: json['departmentHeadDecision'] as String?,
        recipientDecision: json['recipientDecision'] as String?,
        targetType: json['targetType'] as String?,
        totalAssets: json['totalAssets'] as int? ?? 0,
        allocatedAssets: json['allocatedAssets'] as int? ?? 0,
        pendingAssets: json['pendingAssets'] as int? ?? 0,
      );

  final String queueType;
  final String assetId;
  final String assetCode;
  final String assetName;
  final String? requestId;
  final String? allocationId;
  final String? requestCode;
  final String? requestDepartmentId;
  final String? departmentId;
  final String? recipientName;
  final String? location;
  final String? decisionParty;
  final String? departmentHeadDecision;
  final String? recipientDecision;
  final String? targetType;
  final int totalAssets;
  final int allocatedAssets;
  final int pendingAssets;
}

class AssetAllocationGroup {
  const AssetAllocationGroup({
    required this.requestId,
    required this.requestCode,
    required this.totalAssets,
    required this.allocatedAssets,
    required this.pendingAssets,
    required this.tasks,
  });

  final String requestId;
  final String requestCode;
  final int totalAssets;
  final int allocatedAssets;
  final int pendingAssets;
  final List<AssetAllocationTask> tasks;

  double get progress => totalAssets == 0 ? 0 : allocatedAssets / totalAssets;
}

List<AssetAllocationGroup> groupAllocationTasks(
  List<AssetAllocationTask> tasks,
) {
  final grouped = <String, List<AssetAllocationTask>>{};

  for (final task in tasks) {
    final key = task.requestId ?? task.requestCode ?? task.assetId;
    grouped.putIfAbsent(key, () => []).add(task);
  }

  return grouped.entries.map((entry) {
    final first = entry.value.first;

    return AssetAllocationGroup(
      requestId: first.requestId ?? entry.key,
      requestCode: first.requestCode ?? 'Không rõ mã đề nghị',
      totalAssets: first.totalAssets == 0
          ? entry.value.length
          : first.totalAssets,
      allocatedAssets: first.allocatedAssets,
      pendingAssets: first.pendingAssets == 0
          ? entry.value.length
          : first.pendingAssets,
      tasks: entry.value,
    );
  }).toList();
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

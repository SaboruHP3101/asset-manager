class HomeDashboardData {
  const HomeDashboardData({
    required this.assignedAssets,
    required this.activeRequests,
    required this.purchaseRequestTasks,
    required this.purchaseOrderTasks,
    required this.inspectionTasks,
    required this.allocationTasks,
    this.recallTasks = 0,
  });

  factory HomeDashboardData.fromJson(Map<String, dynamic> json) {
    final tasks = Map<String, dynamic>.from(
      json['pendingTasks'] as Map? ?? const {},
    );

    return HomeDashboardData(
      assignedAssets: json['assignedAssets'] as int? ?? 0,
      activeRequests: json['activeRequests'] as int? ?? 0,
      purchaseRequestTasks: tasks['purchaseRequests'] as int? ?? 0,
      purchaseOrderTasks: tasks['purchaseOrders'] as int? ?? 0,
      inspectionTasks: tasks['inspections'] as int? ?? 0,
      allocationTasks: tasks['allocations'] as int? ?? 0,
      recallTasks: tasks['recalls'] as int? ?? 0,
    );
  }

  final int assignedAssets;
  final int activeRequests;
  final int purchaseRequestTasks;
  final int purchaseOrderTasks;
  final int inspectionTasks;
  final int allocationTasks;
  final int recallTasks;
}

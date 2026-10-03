import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/auth/auth_session.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/department_labels.dart';
import '../../../core/widgets/status_card.dart';
import '../../asset_allocations/asset_allocation_queue_screen.dart';
import '../../purchase_orders/purchase_orders_screen.dart';
import '../../purchase_receipts/purchase_inspection_queue_screen.dart';
import '../../purchase_requests/purchase_requests_screen.dart';
import '../../repair_requests/repair_request_form.dart';

typedef HomeDashboardLoader = Future<HomeDashboardData> Function();

class HomeDashboardData {
  const HomeDashboardData({
    required this.assignedAssets,
    required this.activeRequests,
    required this.purchaseRequestTasks,
    required this.purchaseOrderTasks,
    required this.inspectionTasks,
    required this.allocationTasks,
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
    );
  }

  final int assignedAssets;
  final int activeRequests;
  final int purchaseRequestTasks;
  final int purchaseOrderTasks;
  final int inspectionTasks;
  final int allocationTasks;
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    required this.profile,
    super.key,
    this.onOpenAssets,
    this.onOpenRequests,
    this.onScanAssets,
    this.loadDashboard,
  });

  final AuthenticatedProfile profile;
  final VoidCallback? onOpenAssets;
  final VoidCallback? onOpenRequests;
  final VoidCallback? onScanAssets;
  final HomeDashboardLoader? loadDashboard;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  HomeDashboardData? _dashboard;
  String? _error;

  Set<String> get _actions => widget.profile.allowedActions;

  bool get _canProcessPurchaseRequests => _actions.any(
    {
      'purchase.request.approve_department',
      'purchase.request.enrich_procurement',
      'purchase.request.approve_procurement',
      'purchase.request.approve_it',
    }.contains,
  );

  bool get _canAccessPurchaseOrders => _actions.any(
    {
      'purchase.order.create',
      'purchase.order.submit',
      'purchase.order.approve',
      'purchase.order.cancel',
      'purchase.receipt.record',
      'purchase.receipt.close_short',
    }.contains,
  );

  bool get _canInspect => _actions.any(
    {
      'purchase.receipt.inspect_it',
      'purchase.receipt.inspect_procurement',
    }.contains,
  );

  bool get _canAccessAllocationTasks => _actions.any(
    {
      'purchase.allocation.create_initial',
      'purchase.allocation.reallocate_it',
      'purchase.allocation.reallocate_procurement',
      'purchase.allocation.confirm_department',
      'purchase.allocation.confirm_recipient',
    }.contains,
  );

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<HomeDashboardData> _loadFromApi() async {
    final response = await ApiClient.instance.dio.get<Map<String, dynamic>>(
      '/dashboard/mine',
    );

    return HomeDashboardData.fromJson(response.data ?? const {});
  }

  Future<void> _loadSummary() async {
    setState(() => _error = null);
    try {
      final dashboard = await (widget.loadDashboard?.call() ?? _loadFromApi());
      if (!mounted) return;
      setState(() => _dashboard = dashboard);
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.response?.statusCode == 401
            ? 'Phiên đăng nhập đã hết hạn.'
            : 'Không thể tải dữ liệu tổng quan.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Không thể tải dữ liệu tổng quan.');
    }
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(context)
        .push<void>(MaterialPageRoute(builder: (_) => screen));
    await _loadSummary();
  }

  List<_HomeTask> get _visibleTasks {
    final dashboard = _dashboard;
    if (dashboard == null) return const [];

    return [
      if (_canProcessPurchaseRequests && dashboard.purchaseRequestTasks > 0)
        _HomeTask(
          title: 'Đề nghị mua chờ xử lý',
          subtitle: 'Duyệt hoặc bổ sung thông tin đề nghị',
          count: dashboard.purchaseRequestTasks,
          icon: Icons.task_alt_outlined,
          onTap: () => _open(
            PurchaseRequestsScreen(
              allowedActions: _actions,
              initialTab: PurchaseRequestInitialTab.queue,
            ),
          ),
        ),
      if (_canAccessPurchaseOrders && dashboard.purchaseOrderTasks > 0)
        _HomeTask(
          title: 'Đơn đặt mua cần xử lý',
          subtitle: 'Tạo, duyệt hoặc theo dõi giao hàng',
          count: dashboard.purchaseOrderTasks,
          icon: Icons.shopping_cart_checkout_outlined,
          onTap: () => _open(PurchaseOrdersScreen(allowedActions: _actions)),
        ),
      if (_canInspect && dashboard.inspectionTasks > 0)
        _HomeTask(
          title: 'Hàng giao cần kiểm tra',
          subtitle: 'Xác nhận chất lượng tài sản đã nhận',
          count: dashboard.inspectionTasks,
          icon: Icons.fact_check_outlined,
          onTap: () => _open(const PurchaseInspectionQueueScreen()),
        ),
      if (_canAccessAllocationTasks && dashboard.allocationTasks > 0)
        _HomeTask(
          title: 'Cấp phát tài sản',
          subtitle: 'Cấp phát, xác nhận hoặc phân bổ lại',
          count: dashboard.allocationTasks,
          icon: Icons.assignment_ind_outlined,
          onTap: () => _open(const AssetAllocationQueueScreen()),
        ),
    ];
  }

  List<_QuickAction> get _quickActions => [
    if (widget.onScanAssets != null || widget.onOpenAssets != null)
      _QuickAction(
        title: 'Quét mã QR',
        icon: Icons.qr_code_scanner,
        onTap: widget.onScanAssets ?? widget.onOpenAssets!,
      ),
    if (_actions.contains('purchase.request.create'))
      _QuickAction(
        title: 'Đề nghị mua',
        icon: Icons.add_shopping_cart_outlined,
        onTap: () => _open(
          PurchaseRequestsScreen(
            allowedActions: _actions,
            initialTab: PurchaseRequestInitialTab.mine,
          ),
        ),
      ),
    if (_actions.contains('repair.report'))
      _QuickAction(
        title: 'Báo hỏng',
        icon: Icons.build_circle_outlined,
        onTap: () => _open(const RepairRequestForm()),
      ),
  ];

  @override
  Widget build(BuildContext context) {
    final dashboard = _dashboard;
    final tasks = _visibleTasks;
    final department = departmentLabel(widget.profile.department);
    final role = widget.profile.isDepartmentHead ? 'Trưởng phòng' : 'Nhân viên';

    return Scaffold(
      appBar: AppBar(title: const Text('Trang chủ'), centerTitle: true),
      body: RefreshIndicator(
        onRefresh: _loadSummary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _WelcomeHeader(
              fullName: widget.profile.fullName,
              subtitle: [department, role].whereType<String>().join(' · '),
            ),
            const SizedBox(height: 24),
            const _SectionTitle(title: 'Tổng quan'),
            const SizedBox(height: 10),
            if (dashboard == null && _error == null)
              const _SummarySkeleton()
            else if (_error != null)
              _ErrorCard(message: _error!, onRetry: _loadSummary)
            else
              Row(
                children: [
                  Expanded(
                    child: StatusCard(
                      title: 'Tài sản được giao',
                      count: '${dashboard!.assignedAssets}',
                      icon: Icons.inventory_2_outlined,
                      onTap: widget.onOpenAssets,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: StatusCard(
                      title: 'Yêu cầu đang xử lý',
                      count: '${dashboard.activeRequests}',
                      icon: Icons.assignment_outlined,
                      onTap: widget.onOpenRequests,
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 24),
            const _SectionTitle(title: 'Cần bạn xử lý'),
            const SizedBox(height: 10),
            if (dashboard == null && _error == null)
              const _TaskSkeleton()
            else if (dashboard != null && tasks.isEmpty)
              const _EmptyTasks()
            else
              ...tasks.map((task) => _TaskCard(task: task)),
            const SizedBox(height: 24),
            const _SectionTitle(title: 'Thao tác nhanh'),
            const SizedBox(height: 10),
            _QuickActionGrid(actions: _quickActions),
          ],
        ),
      ),
    );
  }
}

class _WelcomeHeader extends StatelessWidget {
  const _WelcomeHeader({required this.fullName, required this.subtitle});

  final String fullName;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Semantics(
    header: true,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          fullName.isEmpty ? 'Xin chào!' : 'Xin chào, $fullName',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 5),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Text(
    title,
    style: Theme.of(context).textTheme.titleLarge
        ?.copyWith(fontWeight: FontWeight.w700),
  );
}

class _HomeTask {
  const _HomeTask({
    required this.title,
    required this.subtitle,
    required this.count,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final int count;
  final IconData icon;
  final VoidCallback onTap;
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.task});

  final _HomeTask task;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    elevation: 0,
    color: Theme.of(context).colorScheme.surfaceContainerLow,
    clipBehavior: Clip.antiAlias,
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: CircleAvatar(child: Icon(task.icon)),
      title: Text(task.title),
      subtitle: Text(task.subtitle),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Badge(label: Text('${task.count}')),
          const SizedBox(width: 6),
          const Icon(Icons.chevron_right),
        ],
      ),
      onTap: task.onTap,
    ),
  );
}

class _EmptyTasks extends StatelessWidget {
  const _EmptyTasks();

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    elevation: 0,
    color: Theme.of(context).colorScheme.surfaceContainerLow,
    child: const Padding(
      padding: EdgeInsets.all(16),
      child: Row(
        children: [
          Icon(Icons.check_circle_outline),
          SizedBox(width: 12),
          Expanded(child: Text('Bạn không có công việc cần xử lý.')),
        ],
      ),
    ),
  );
}

class _QuickAction {
  const _QuickAction({
    required this.title,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final VoidCallback onTap;
}

class _QuickActionGrid extends StatelessWidget {
  const _QuickActionGrid({required this.actions});

  final List<_QuickAction> actions;

  @override
  Widget build(BuildContext context) => GridView.builder(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    itemCount: actions.length,
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.75,
    ),
    itemBuilder: (context, index) {
      final action = actions[index];

      return Card(
        margin: EdgeInsets.zero,
        elevation: 0,
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: action.onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(action.icon, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 9),
                Text(
                  action.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined),
          const SizedBox(width: 12),
          Expanded(child: Text(message)),
          TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

class _SummarySkeleton extends StatelessWidget {
  const _SummarySkeleton();

  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (var index = 0; index < 2; index++) ...[
        if (index > 0) const SizedBox(width: 10),
        const Expanded(child: _SkeletonBlock(height: 118)),
      ],
    ],
  );
}

class _TaskSkeleton extends StatelessWidget {
  const _TaskSkeleton();

  @override
  Widget build(BuildContext context) => const Column(
    children: [
      _SkeletonBlock(height: 76),
      SizedBox(height: 10),
      _SkeletonBlock(height: 76),
    ],
  );
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  );
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/auth/auth_session.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/department_labels.dart';
import '../../../core/widgets/status_card.dart';
import '../../asset_allocations/asset_allocation_queue_screen.dart';
import '../../asset_depreciations/depreciation_screens.dart';
import '../../chat/chat_screen.dart';
import '../../asset_recalls/asset_recall_requests_screen.dart';
import '../../asset_recalls/asset_upgrade_requests_screen.dart';
import '../../purchase_orders/purchase_orders_screen.dart';
import '../../purchase_receipts/purchase_inspection_queue_screen.dart';
import '../../purchase_requests/purchase_requests_screen.dart';
import '../../repair_requests/repair_request_form.dart';
import '../../warehouses/it_warehouse_screen.dart';

import 'home_dashboard_data.dart';
import 'home_dashboard_widgets.dart';

export 'home_dashboard_data.dart';

typedef HomeDashboardLoader = Future<HomeDashboardData> Function();

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

  Future<void> _openRecallQueue() async {
    final screen = await showModalBottomSheet<Widget>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.swap_horiz),
              title: const Text('Đổi / báo phế tài sản'),
              onTap: () => Navigator.pop(
                context,
                const AssetRecallRequestsScreen(
                  initialTab: AssetRecallInitialTab.queue,
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.upgrade),
              title: const Text('Nâng cấp tài sản'),
              onTap: () => Navigator.pop(
                context,
                const AssetUpgradeRequestsScreen(
                  initialTab: AssetRecallInitialTab.queue,
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (screen != null && mounted) await _open(screen);
  }

  List<HomeTask> get _visibleTasks {
    final dashboard = _dashboard;
    if (dashboard == null) return const [];

    return [
      if (_canProcessPurchaseRequests && dashboard.purchaseRequestTasks > 0)
        HomeTask(
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
        HomeTask(
          title: 'Đơn đặt mua cần xử lý',
          subtitle: 'Tạo, duyệt hoặc theo dõi giao hàng',
          count: dashboard.purchaseOrderTasks,
          icon: Icons.shopping_cart_checkout_outlined,
          onTap: () => _open(PurchaseOrdersScreen(allowedActions: _actions)),
        ),
      if (_canInspect && dashboard.inspectionTasks > 0)
        HomeTask(
          title: 'Hàng giao cần kiểm tra',
          subtitle: 'Xác nhận chất lượng tài sản đã nhận',
          count: dashboard.inspectionTasks,
          icon: Icons.fact_check_outlined,
          onTap: () => _open(const PurchaseInspectionQueueScreen()),
        ),
      if (_canAccessAllocationTasks && dashboard.allocationTasks > 0)
        HomeTask(
          title: 'Cấp phát tài sản',
          subtitle: 'Cấp phát, xác nhận hoặc phân bổ lại',
          count: dashboard.allocationTasks,
          icon: Icons.assignment_ind_outlined,
          onTap: () => _open(const AssetAllocationQueueScreen()),
        ),
      if (dashboard.recallTasks > 0)
        HomeTask(
          title: 'Thu hồi tài sản cần xử lý',
          subtitle: 'Duyệt hoặc xác nhận bàn giao',
          count: dashboard.recallTasks,
          icon: Icons.swap_horiz,
          onTap: _openRecallQueue,
        ),
    ];
  }

  List<HomeQuickAction> get _quickActions => [
    HomeQuickAction(
      title: 'Trợ lý AI',
      icon: Icons.chat_bubble_outline,
      onTap: () => _open(const ChatScreen()),
    ),
    if (_actions.contains('depreciation.view'))
      HomeQuickAction(
        title: 'Khấu hao',
        icon: Icons.trending_down,
        onTap: () => _open(DepreciationPeriodsScreen(profile: widget.profile)),
      ),
    if (widget.onScanAssets != null || widget.onOpenAssets != null)
      HomeQuickAction(
        title: 'Quét mã QR',
        icon: Icons.qr_code_scanner,
        onTap: widget.onScanAssets ?? widget.onOpenAssets!,
      ),
    if (_actions.contains('purchase.request.create'))
      HomeQuickAction(
        title: 'Đề nghị mua',
        icon: Icons.add_shopping_cart_outlined,
        onTap: () => _open(
          PurchaseRequestsScreen(
            allowedActions: _actions,
            initialTab: PurchaseRequestInitialTab.mine,
          ),
        ),
      ),
    if (_actions.contains('purchase.order.create'))
      HomeQuickAction(
        title: 'Đơn đặt mua',
        icon: Icons.shopping_cart_checkout_outlined,
        onTap: () => _open(PurchaseOrdersScreen(allowedActions: _actions)),
      ),
    if (_actions.contains('asset.recall.create'))
      HomeQuickAction(
        title: 'Đổi / báo phế',
        icon: Icons.swap_horiz,
        onTap: () => _open(const AssetRecallRequestsScreen()),
      ),
    if (_actions.contains('asset.recall.create'))
      HomeQuickAction(
        title: 'Nâng cấp',
        icon: Icons.upgrade,
        onTap: () => _open(const AssetUpgradeRequestsScreen()),
      ),
    if (_actions.contains('warehouse.it.view'))
      HomeQuickAction(
        title: 'Kho IT',
        icon: Icons.warehouse_outlined,
        onTap: () => _open(const ItWarehouseScreen()),
      ),
    if (_actions.contains('repair.report'))
      HomeQuickAction(
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
            HomeWelcomeHeader(
              fullName: widget.profile.fullName,
              subtitle: [department, role].whereType<String>().join(' · '),
            ),
            const SizedBox(height: 24),
            const HomeSectionTitle(title: 'Tổng quan'),
            const SizedBox(height: 10),
            if (dashboard == null && _error == null)
              const HomeSummarySkeleton()
            else if (_error != null)
              HomeErrorCard(message: _error!, onRetry: _loadSummary)
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
            const HomeSectionTitle(title: 'Cần bạn xử lý'),
            const SizedBox(height: 10),
            if (dashboard == null && _error == null)
              const HomeTaskSkeleton()
            else if (dashboard != null && tasks.isEmpty)
              const HomeEmptyTasks()
            else
              ...tasks.map((task) => HomeTaskCard(task: task)),
            const SizedBox(height: 24),
            const HomeSectionTitle(title: 'Thao tác nhanh'),
            const SizedBox(height: 10),
            HomeQuickActionGrid(actions: _quickActions),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../core/auth/auth_session.dart';
import '../../core/widgets/retry_message.dart';
import '../asset_allocations/asset_allocation_queue_screen.dart';
import '../asset_allocations/asset_allocations_repository.dart';
import '../purchase_orders/purchase_order_models.dart';
import '../purchase_orders/purchase_orders_repository.dart';
import '../purchase_orders/purchase_orders_screen.dart';
import '../purchase_receipts/purchase_inspection_queue_screen.dart';
import '../purchase_receipts/purchase_receipts_repository.dart';
import '../purchase_requests/purchase_requests_repository.dart';
import '../purchase_requests/purchase_requests_screen.dart';

class PurchaseHubScreen extends StatefulWidget {
  const PurchaseHubScreen({
    required this.profile,
    super.key,
    this.requestsRepository,
    this.ordersRepository,
    this.receiptsRepository,
    this.allocationsRepository,
  });

  final AuthenticatedProfile profile;
  final PurchaseRequestsRepository? requestsRepository;
  final PurchaseOrdersRepository? ordersRepository;
  final PurchaseReceiptsRepository? receiptsRepository;
  final AssetAllocationsRepository? allocationsRepository;

  @override
  State<PurchaseHubScreen> createState() => _PurchaseHubScreenState();
}

class _PurchaseHubScreenState extends State<PurchaseHubScreen> {
  late final PurchaseRequestsRepository _requestsRepository;
  late final PurchaseOrdersRepository _ordersRepository;
  late final PurchaseReceiptsRepository _receiptsRepository;
  late final AssetAllocationsRepository _allocationsRepository;

  _HubCounts? _counts;
  String? _error;

  Set<String> get _actions => widget.profile.allowedActions;

  bool get _canViewMine => _actions.any(
    {
      'purchase.request.create',
      'purchase.request.update',
      'purchase.request.submit',
    }.contains,
  );

  bool get _canProcessRequests => _actions.any(
    {
      'purchase.request.approve_department',
      'purchase.request.enrich_procurement',
      'purchase.request.approve_procurement',
      'purchase.request.approve_it',
    }.contains,
  );

  bool get _canAccessOrders => _actions.any(
    {
      'purchase.order.create',
      'purchase.order.submit',
      'purchase.order.approve',
      'purchase.order.cancel',
      'purchase.receipt.record',
      'purchase.receipt.close_short',
    }.contains,
  );

  bool get _canCreateOrder => _actions.contains('purchase.order.create');
  bool get _canApproveOrder => _actions.contains('purchase.order.approve');
  bool get _canTrackOrders => _actions.any(
    {'purchase.receipt.record', 'purchase.receipt.close_short'}.contains,
  );

  bool get _canInspect => _actions.any(
    {
      'purchase.receipt.inspect_it',
      'purchase.receipt.inspect_procurement',
    }.contains,
  );

  bool get _canManageAllocations => _actions.any(
    {
      'purchase.allocation.create_initial',
      'purchase.allocation.reallocate_it',
      'purchase.allocation.reallocate_procurement',
      'purchase.allocation.confirm_department',
    }.contains,
  );

  @override
  void initState() {
    super.initState();
    _requestsRepository =
        widget.requestsRepository ?? PurchaseRequestsRepository();
    _ordersRepository = widget.ordersRepository ?? PurchaseOrdersRepository();
    _receiptsRepository =
        widget.receiptsRepository ?? PurchaseReceiptsRepository();
    _allocationsRepository =
        widget.allocationsRepository ?? AssetAllocationsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _counts = null;
      _error = null;
    });
    try {
      var mine = 0;
      var requestQueue = 0;
      var eligibleRequests = 0;
      var approvalQueue = 0;
      var orders = <PurchaseOrderSummary>[];
      var inspectionQueue = 0;
      var allocationQueue = 0;
      await Future.wait<void>([
        if (_canViewMine)
          _requestsRepository.findMine().then((items) {
            mine = items.length;
          }),
        if (_canProcessRequests)
          _requestsRepository.findQueue().then((items) {
            requestQueue = items.length;
          }),
        if (_canCreateOrder)
          _ordersRepository.findEligibleRequests().then((items) {
            eligibleRequests = items.length;
          }),
        if (_canApproveOrder)
          _ordersRepository.findApprovalQueue().then((items) {
            approvalQueue = items.length;
          }),
        if (_canTrackOrders || _canCreateOrder)
          _ordersRepository.findAll().then((items) {
            orders = items;
          }),
        if (_canInspect)
          _receiptsRepository.findInspectionQueue().then((items) {
            inspectionQueue = items.length;
          }),
        _allocationsRepository.findQueue().then((items) {
          allocationQueue = items.length;
        }),
      ]);
      if (!mounted) return;

      final ongoingOrderCount = orders
          .where(
            (order) => ['issued', 'partially_received'].contains(order.status),
          )
          .length;
      final draftOrderCount = _canCreateOrder
          ? orders.where((order) => order.status == 'draft').length
          : 0;
      setState(() {
        _counts = _HubCounts(
          mine: mine,
          requestQueue: requestQueue,
          orderQueue:
              eligibleRequests +
              approvalQueue +
              draftOrderCount +
              ongoingOrderCount,
          inspectionQueue: inspectionQueue,
          allocationQueue: allocationQueue,
        );
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = purchaseApiError(error));
    }
  }

  Future<void> _open(Widget screen) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(builder: (_) => screen),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Mua sắm tài sản'), centerTitle: true),
    body: _error != null
        ? RetryMessage(message: _error!, onRetry: _load)
        : _counts == null
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Công việc của bạn',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                if (_canViewMine)
                  _HubCard(
                    title: 'Đề nghị của tôi',
                    subtitle: 'Tạo mới và theo dõi đề nghị mua',
                    icon: Icons.description_outlined,
                    count: _counts!.mine,
                    onTap: () => _open(
                      PurchaseRequestsScreen(
                        allowedActions: _actions,
                        initialTab: PurchaseRequestInitialTab.mine,
                      ),
                    ),
                  ),
                if (_canProcessRequests)
                  _HubCard(
                    title: 'Việc cần xử lý',
                    subtitle: 'Duyệt hoặc bổ sung thông tin đề nghị',
                    icon: Icons.task_alt_outlined,
                    count: _counts!.requestQueue,
                    onTap: () => _open(
                      PurchaseRequestsScreen(
                        allowedActions: _actions,
                        initialTab: PurchaseRequestInitialTab.queue,
                      ),
                    ),
                  ),
                if (_canAccessOrders)
                  _HubCard(
                    title: 'Đơn đặt mua',
                    subtitle: 'Tạo, duyệt và theo dõi giao hàng',
                    icon: Icons.shopping_cart_checkout,
                    count: _counts!.orderQueue,
                    onTap: () =>
                        _open(PurchaseOrdersScreen(allowedActions: _actions)),
                  ),
                if (_canInspect)
                  _HubCard(
                    title: 'Kiểm tra hàng giao',
                    subtitle: 'Xác nhận chất lượng tài sản đã nhận',
                    icon: Icons.fact_check_outlined,
                    count: _counts!.inspectionQueue,
                    onTap: () => _open(const PurchaseInspectionQueueScreen()),
                  ),
                if (_canManageAllocations || _counts!.allocationQueue > 0)
                  _HubCard(
                    title: 'Cấp phát tài sản',
                    subtitle: 'Cấp phát, xác nhận hoặc phân bổ lại',
                    icon: Icons.assignment_ind_outlined,
                    count: _counts!.allocationQueue,
                    onTap: () => _open(const AssetAllocationQueueScreen()),
                  ),
                if (!_canViewMine &&
                    !_canProcessRequests &&
                    !_canAccessOrders &&
                    !_canInspect &&
                    !_canManageAllocations &&
                    _counts!.allocationQueue == 0)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Bạn không có công việc mua sắm cần xử lý.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ),
  );
}

class _HubCounts {
  const _HubCounts({
    required this.mine,
    required this.requestQueue,
    required this.orderQueue,
    required this.inspectionQueue,
    required this.allocationQueue,
  });

  final int mine;
  final int requestQueue;
  final int orderQueue;
  final int inspectionQueue;
  final int allocationQueue;
}

class _HubCard extends StatelessWidget {
  const _HubCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.count,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Badge(label: Text('$count')),
          const SizedBox(width: 8),
          const Icon(Icons.chevron_right),
        ],
      ),
      onTap: onTap,
    ),
  );
}

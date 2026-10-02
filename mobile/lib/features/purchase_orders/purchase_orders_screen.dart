import 'package:flutter/material.dart';

import '../../core/auth/auth_session.dart';
import 'purchase_order_detail_screen.dart';
import 'purchase_order_form.dart';
import 'purchase_order_models.dart';
import 'purchase_orders_repository.dart';

class PurchaseOrdersScreen extends StatefulWidget {
  const PurchaseOrdersScreen({super.key, this.repository, this.allowedActions});
  final PurchaseOrdersRepository? repository;
  final Set<String>? allowedActions;

  /// Tạo state
  @override
  State<PurchaseOrdersScreen> createState() => _PurchaseOrdersScreenState();
}

class _PurchaseOrdersScreenState extends State<PurchaseOrdersScreen> {
  late final PurchaseOrdersRepository _repository;
  List<EligiblePurchaseOrderItem>? _eligible;
  List<PurchaseOrderSummary>? _orders;
  List<PurchaseOrderSummary>? _queue;
  String? _error;

  Set<String> get _actions =>
      widget.allowedActions ??
      AuthSession.instance.profile?.allowedActions ??
      const {};

  bool get _canCreate => _actions.contains('purchase.order.create');
  bool get _canApprove => _actions.contains('purchase.order.approve');
  bool get _canRecord => _actions.contains('purchase.receipt.record');
  /// Khởi tạo repository rồi tải đồng thời các tab đơn mua
  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseOrdersRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _eligible = null;
      _orders = null;
      _queue = null;
      _error = null;
    });
    try {
      final results = await Future.wait([
        if (_canCreate)
          _repository.findEligibleRequests()
        else
          Future.value(<EligiblePurchaseOrderItem>[]),
        _repository.findAll(),
        if (_canApprove)
          _repository.findApprovalQueue()
        else
          Future.value(<PurchaseOrderSummary>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _eligible = results[0] as List<EligiblePurchaseOrderItem>;
        _orders = results[1] as List<PurchaseOrderSummary>;
        _queue = results[2] as List<PurchaseOrderSummary>;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = purchaseOrderApiError(error));
    }
  }

  Future<void> _create({String? requestId}) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PurchaseOrderFormScreen(
          repository: _repository,
          initialRequestId: requestId,
        ),
      ),
    );
    if (changed == true) await _load();
  }

  Future<void> _open(String id) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            PurchaseOrderDetailScreen(orderId: id, repository: _repository),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final loading = _orders == null && _error == null;
    final tabs = <Tab>[];
    final views = <Widget>[];

    if (_canCreate || _canApprove) {
      tabs.add(const Tab(text: 'Cần xử lý'));
      views.add(
        _PurchaseOrderWorkList(
          eligible: _eligible ?? [],
          approvals: _queue ?? [],
          onCreate: _create,
          onOpen: _open,
          onRefresh: _load,
        ),
      );
    }
    if (_canRecord) {
      tabs.add(const Tab(text: 'Đang thực hiện'));
      views.add(
        _OrderList(
          items: (_orders ?? [])
              .where(
                (item) =>
                    ['issued', 'partially_received'].contains(item.status),
              )
              .toList(),
          onOpen: _open,
          onRefresh: _load,
          emptyMessage: 'Không có đơn mua nào đang chờ giao.',
        ),
      );
    }
    tabs.add(const Tab(text: 'Tất cả'));
    views.add(
      _OrderList(items: _orders ?? [], onOpen: _open, onRefresh: _load),
    );
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Đơn đặt mua'),
          bottom: TabBar(isScrollable: true, tabs: tabs),
        ),
        body: _error != null
            ? _ScreenMessage(message: _error!, onRetry: _load)
            : loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(children: views),
        floatingActionButton: _canCreate && (_eligible?.isNotEmpty ?? false)
            ? FloatingActionButton.extended(
                onPressed: _create,
                icon: const Icon(Icons.add),
                label: const Text('Tạo PO'),
              )
            : null,
      ),
    );
  }
}

class _PurchaseOrderWorkList extends StatelessWidget {
  const _PurchaseOrderWorkList({
    required this.eligible,
    required this.approvals,
    required this.onCreate,
    required this.onOpen,
    required this.onRefresh,
  });

  final List<EligiblePurchaseOrderItem> eligible;
  final List<PurchaseOrderSummary> approvals;
  final void Function({String? requestId}) onCreate;
  final ValueChanged<String> onOpen;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final requestIds = eligible.map((item) => item.requestId).toSet().toList();
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: requestIds.isEmpty && approvals.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                Icon(Icons.inbox_outlined, size: 56),
                SizedBox(height: 12),
                Text(
                  'Không có đơn mua nào cần xử lý.',
                  textAlign: TextAlign.center,
                ),
              ],
            )
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                if (requestIds.isNotEmpty) ...[
                  Text(
                    'Cần tạo đơn',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (final requestId in requestIds)
                    _EligibleCard(
                      items: eligible
                          .where((item) => item.requestId == requestId)
                          .toList(),
                      onCreate: onCreate,
                    ),
                ],
                if (approvals.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Chờ duyệt',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (final item in approvals)
                    _OrderCard(item: item, onOpen: onOpen),
                ],
              ],
            ),
    );
  }
}

class _EligibleCard extends StatelessWidget {
  const _EligibleCard({required this.items, required this.onCreate});

  final List<EligiblePurchaseOrderItem> items;
  final void Function({String? requestId}) onCreate;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      title: Text(items.first.requestCode),
      subtitle: Text(
        items
            .map(
              (item) =>
                  '${item.itemName}: còn ${item.remainingQuantity} (${item.supplierName})',
            )
            .join('\n'),
      ),
      trailing: const Icon(Icons.add_shopping_cart),
      onTap: () => onCreate(requestId: items.first.requestId),
    ),
  );
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.item, required this.onOpen});

  final PurchaseOrderSummary item;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      title: Text(item.purchaseOrderCode),
      subtitle: Text(
        '${purchaseOrderStatusLabel(item.status)} • ${item.supplierName}\n'
        '${item.requestCode} • Giao ${item.expectedDeliveryDate}',
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => onOpen(item.id),
    ),
  );
}

class _OrderList extends StatelessWidget {
  const _OrderList({
    required this.items,
    required this.onOpen,
    required this.onRefresh,
    this.emptyMessage = 'Không có đơn đặt mua.',
  });
  final List<PurchaseOrderSummary> items;
  final ValueChanged<String> onOpen;
  final Future<void> Function() onRefresh;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: onRefresh,
    child: items.isEmpty
        ? ListView(
            children: [
              const SizedBox(height: 120),
              const Icon(Icons.inbox_outlined, size: 56),
              const SizedBox(height: 12),
              Text(emptyMessage, textAlign: TextAlign.center),
            ],
          )
        : ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final item = items[index];
              return Card(
                child: ListTile(
                  title: Text(item.purchaseOrderCode),
                  subtitle: Text(
                    '${purchaseOrderStatusLabel(item.status)} • ${item.supplierName}\n'
                    '${item.requestCode} • Giao ${item.expectedDeliveryDate}',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => onOpen(item.id),
                ),
              );
            },
          ),
  );
}

class _ScreenMessage extends StatelessWidget {
  const _ScreenMessage({required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null)
            FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

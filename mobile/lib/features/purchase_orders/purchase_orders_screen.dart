import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'purchase_order_detail_screen.dart';
import 'purchase_order_form.dart';
import 'purchase_order_models.dart';
import 'purchase_orders_repository.dart';

class PurchaseOrdersScreen extends StatefulWidget {
  const PurchaseOrdersScreen({super.key, this.repository});
  final PurchaseOrdersRepository? repository;

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
        _withoutForbidden(_repository.findEligibleRequests()),
        _repository.findAll(),
        _withoutForbidden(_repository.findApprovalQueue()),
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

  /// Biến riêng HTTP 403 thành list rỗng để user không thấy tab/action ngoài quyền
  Future<List<T>> _withoutForbidden<T>(Future<List<T>> request) async {
    try {
      return await request;
    } on DioException catch (error) {
      if (error.response?.statusCode == 403) return [];
      rethrow;
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
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Đơn đặt mua'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Cần đặt'),
              Tab(text: 'Tất cả PO'),
              Tab(text: 'Chờ duyệt'),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'Tải lại',
              onPressed: loading ? null : _load,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: _error != null
            ? _ScreenMessage(message: _error!, onRetry: _load)
            : loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _EligibleList(items: _eligible!, onCreate: _create),
                  _OrderList(items: _orders!, onOpen: _open, onRefresh: _load),
                  _OrderList(items: _queue!, onOpen: _open, onRefresh: _load),
                ],
              ),
        floatingActionButton: (_eligible?.isNotEmpty ?? false)
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

class _EligibleList extends StatelessWidget {
  const _EligibleList({required this.items, required this.onCreate});
  final List<EligiblePurchaseOrderItem> items;
  final void Function({String? requestId}) onCreate;

  @override
  Widget build(BuildContext context) {
    final requestIds = items.map((item) => item.requestId).toSet().toList();
    if (requestIds.isEmpty) {
      return const _ScreenMessage(
        message: 'Không có đề nghị đã duyệt nào cần đặt thêm.',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: requestIds.length,
      itemBuilder: (context, index) {
        final requestItems = items
            .where((item) => item.requestId == requestIds[index])
            .toList();
        return Card(
          child: ListTile(
            title: Text(requestItems.first.requestCode),
            subtitle: Text(
              requestItems
                  .map(
                    (item) =>
                        '${item.itemName}: còn ${item.remainingQuantity} (${item.supplierName})',
                  )
                  .join('\n'),
            ),
            trailing: const Icon(Icons.add_shopping_cart),
            onTap: () => onCreate(requestId: requestItems.first.requestId),
          ),
        );
      },
    );
  }
}

class _OrderList extends StatelessWidget {
  const _OrderList({
    required this.items,
    required this.onOpen,
    required this.onRefresh,
  });
  final List<PurchaseOrderSummary> items;
  final ValueChanged<String> onOpen;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: onRefresh,
    child: items.isEmpty
        ? ListView(
            children: const [
              SizedBox(height: 120),
              Icon(Icons.inbox_outlined, size: 56),
              SizedBox(height: 12),
              Text('Không có đơn đặt mua.', textAlign: TextAlign.center),
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

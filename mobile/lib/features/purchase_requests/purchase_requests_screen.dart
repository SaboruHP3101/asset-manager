import 'package:flutter/material.dart';

import '../purchase_orders/purchase_orders_screen.dart';
import 'purchase_request_detail_screen.dart';
import 'purchase_request_form.dart';
import 'purchase_request_models.dart';
import 'purchase_requests_repository.dart';

class PurchaseRequestsScreen extends StatefulWidget {
  const PurchaseRequestsScreen({super.key, this.repository});

  final PurchaseRequestsRepository? repository;

  @override
  State<PurchaseRequestsScreen> createState() => _PurchaseRequestsScreenState();
}

class _PurchaseRequestsScreenState extends State<PurchaseRequestsScreen> {
  late final PurchaseRequestsRepository _repository;
  List<PurchaseRequestSummary>? _mine;
  List<PurchaseRequestSummary>? _queue;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseRequestsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _mine = null;
      _queue = null;
      _error = null;
    });
    try {
      // Lấy 2 list request
      final results = await Future.wait([
        _repository.findMine(),
        _repository.findQueue(),
      ]);
      if (!mounted) return;
      setState(() {
        _mine = results[0];
        _queue = results[1];
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = purchaseApiError(error));
    }
  }

  Future<void> _create() async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PurchaseRequestFormScreen(repository: _repository),
      ),
    );
    if (changed == true) await _load();
  }

  Future<void> _open(String id) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            PurchaseRequestDetailScreen(requestId: id, repository: _repository),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Đề nghị mua'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Của tôi'),
              Tab(text: 'Chờ xử lý'),
            ],
          ),
          centerTitle: true,
          actions: [
            IconButton(
              tooltip: 'Đơn đặt mua',
              onPressed: () => Navigator.push<void>(
                context,
                MaterialPageRoute(builder: (_) => const PurchaseOrdersScreen()),
              ),
              icon: const Icon(Icons.shopping_cart_checkout),
            ),
            IconButton(
              tooltip: 'Tải lại',
              onPressed: _mine == null && _error == null ? null : _load,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: _error != null
            ? _ListError(message: _error!, onRetry: _load)
            : _mine == null
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  Center(
                    child: PurchaseRequestList(
                      items: _mine!,
                      emptyMessage: 'Bạn chưa có đề nghị mua nào.',
                      onRefresh: _load,
                      onOpen: _open,
                    ),
                  ),
                  Center(
                    child: PurchaseRequestList(
                      items: _queue!,
                      emptyMessage: 'Không có đề nghị nào đang chờ bạn xử lý.',
                      onRefresh: _load,
                      onOpen: _open,
                    ),
                  ),
                ],
              ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _create,
          icon: const Icon(Icons.add),
          label: const Text('Tạo đề nghị'),
        ),
      ),
    );
  }
}

class PurchaseRequestList extends StatelessWidget {
  const PurchaseRequestList({
    required this.items,
    required this.emptyMessage,
    required this.onRefresh,
    required this.onOpen,
    super.key,
  });

  final List<PurchaseRequestSummary> items;
  final String emptyMessage;
  final Future<void> Function() onRefresh;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items.isEmpty
          ? ListView(
              children: [
                const SizedBox(height: 120),
                Icon(
                  Icons.inbox_outlined,
                  size: 56,
                  color: Theme.of(context).colorScheme.outline,
                ),
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
                    title: Text(item.requestCode),
                    subtitle: Text(
                      '${purchaseStatusLabel(item.status)} • Revision ${item.revision}'
                      '${item.requesterName == null ? '' : '\n${item.requesterName}'}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => onOpen(item.id),
                  ),
                );
              },
            ),
    );
  }
}

class _ListError extends StatelessWidget {
  const _ListError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

import 'package:flutter/material.dart';

import '../../core/auth/auth_session.dart';
import 'purchase_request_detail_screen.dart';
import 'purchase_request_form.dart';
import 'purchase_request_models.dart';
import 'purchase_requests_repository.dart';

enum PurchaseRequestInitialTab { mine, queue }

class PurchaseRequestsScreen extends StatefulWidget {
  const PurchaseRequestsScreen({
    super.key,
    this.repository,
    this.allowedActions,
    this.initialTab = PurchaseRequestInitialTab.mine,
  });

  final PurchaseRequestsRepository? repository;
  final Set<String>? allowedActions;
  final PurchaseRequestInitialTab initialTab;

  @override
  State<PurchaseRequestsScreen> createState() => _PurchaseRequestsScreenState();
}

class _PurchaseRequestsScreenState extends State<PurchaseRequestsScreen> {
  late final PurchaseRequestsRepository _repository;
  List<PurchaseRequestSummary>? _mine;
  List<PurchaseRequestSummary>? _queue;
  String? _error;

  Set<String> get _actions =>
      widget.allowedActions ??
      AuthSession.instance.profile?.allowedActions ??
      const {};

  bool get _canProcessRequests => _actions.any(
    {
      'purchase.request.approve_department',
      'purchase.request.enrich_procurement',
      'purchase.request.approve_procurement',
      'purchase.request.approve_it',
    }.contains,
  );

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
      final mine = await _repository.findMine();
      final queue = _canProcessRequests
          ? await _repository.findQueue()
          : <PurchaseRequestSummary>[];
      if (!mounted) return;
      setState(() {
        _mine = mine;
        _queue = queue;
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
    final tabCount = _canProcessRequests ? 2 : 1;

    return DefaultTabController(
      length: tabCount,
      initialIndex:
          widget.initialTab == PurchaseRequestInitialTab.queue &&
              _canProcessRequests
          ? 1
          : 0,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Đề nghị mua'),
          bottom: TabBar(
            tabs: [
              const Tab(text: 'Của tôi'),
              if (_canProcessRequests) const Tab(text: 'Chờ xử lý'),
            ],
          ),
          centerTitle: true,
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
                  if (_canProcessRequests)
                    Center(
                      child: PurchaseRequestList(
                        items: _queue!,
                        emptyMessage:
                            'Không có đề nghị nào đang chờ bạn xử lý.',
                        onRefresh: _load,
                        onOpen: _open,
                      ),
                    ),
                ],
              ),
        floatingActionButton: _actions.contains('purchase.request.create')
            ? FloatingActionButton.extended(
                onPressed: _create,
                icon: const Icon(Icons.add),
                label: const Text('Tạo đề nghị'),
              )
            : null,
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

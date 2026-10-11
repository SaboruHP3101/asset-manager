import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'asset_recall_detail_screen.dart';
import 'asset_recall_models.dart';
import 'asset_recalls_repository.dart';

enum AssetRecallInitialTab { mine, queue }

class AssetRecallRequestsScreen extends StatefulWidget {
  const AssetRecallRequestsScreen({
    super.key,
    this.initialTab = AssetRecallInitialTab.mine,
    this.repository,
    this.typeFilter,
    this.title = 'Thu hồi tài sản',
  });

  final AssetRecallInitialTab initialTab;
  final AssetRecallsRepository? repository;
  final String? typeFilter;
  final String title;

  @override
  State<AssetRecallRequestsScreen> createState() =>
      _AssetRecallRequestsScreenState();
}

class _AssetRecallRequestsScreenState extends State<AssetRecallRequestsScreen>
    with SingleTickerProviderStateMixin {
  late final AssetRecallsRepository _repository;
  late final TabController _tabs;
  List<Map<String, dynamic>>? _mine;
  List<Map<String, dynamic>>? _queue;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? AssetRecallsRepository();
    _tabs = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTab == AssetRecallInitialTab.mine ? 0 : 1,
    );
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final results = await Future.wait([
        _repository.findMine(),
        _repository.findQueue(),
      ]);
      if (!mounted) return;
      setState(() {
        _mine = _filter(results[0]);
        _queue = _filter(results[1]);
      });
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = recallErrorMessage(
          error.response?.data,
          'Không thể tải phiếu thu hồi tài sản.',
        );
      });
    }
  }

  List<Map<String, dynamic>> _filter(List<Map<String, dynamic>> items) => items
      .where(
        (item) => widget.typeFilter == null
            ? item['type'] != 'upgrade'
            : item['type'] == widget.typeFilter,
      )
      .toList();

  Future<void> _open(String id) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) =>
            AssetRecallDetailScreen(requestId: id, repository: _repository),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.title),
      bottom: TabBar(
        controller: _tabs,
        tabs: const [
          Tab(text: 'Phiếu của tôi'),
          Tab(text: 'Cần xử lý'),
        ],
      ),
    ),
    body: _error != null
        ? Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error!),
                const SizedBox(height: 12),
                FilledButton(onPressed: _load, child: const Text('Thử lại')),
              ],
            ),
          )
        : TabBarView(
            controller: _tabs,
            children: [
              _RecallList(
                items: _mine,
                emptyMessage: widget.typeFilter == 'upgrade'
                    ? 'Chưa có phiếu nâng cấp tài sản.'
                    : 'Chưa có phiếu thu hồi tài sản.',
                employeeView: true,
                onRefresh: _load,
                onOpen: _open,
              ),
              _RecallList(
                items: _queue,
                emptyMessage: widget.typeFilter == 'upgrade'
                    ? 'Không có phiếu nâng cấp cần xử lý.'
                    : 'Không có phiếu thu hồi cần xử lý.',
                employeeView: false,
                onRefresh: _load,
                onOpen: _open,
              ),
            ],
          ),
  );
}

class _RecallList extends StatelessWidget {
  const _RecallList({
    required this.items,
    required this.emptyMessage,
    required this.employeeView,
    required this.onRefresh,
    required this.onOpen,
  });

  final List<Map<String, dynamic>>? items;
  final String emptyMessage;
  final bool employeeView;
  final Future<void> Function() onRefresh;
  final Future<void> Function(String id) onOpen;

  @override
  Widget build(BuildContext context) {
    if (items == null) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items!.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 160),
                const Icon(Icons.inbox_outlined, size: 52),
                const SizedBox(height: 12),
                Center(child: Text(emptyMessage)),
              ],
            )
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: items!.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final item = items![index];
                final status = item['status'] as String;
                final statusLabel =
                    employeeView &&
                        item['type'] == 'disposal' &&
                        status == 'in_progress'
                    ? 'Đã bàn giao'
                    : item['type'] == 'upgrade' && status == 'in_progress'
                    ? 'Đang nâng cấp'
                    : assetRecallStatusLabel(status);

                return Card(
                  child: ListTile(
                    leading: Icon(switch (item['type']) {
                      'disposal' => Icons.delete_outline,
                      'upgrade' => Icons.upgrade,
                      _ => Icons.swap_horiz,
                    }),
                    title: Text(item['assetName'] as String? ?? 'Tài sản'),
                    subtitle: Text('${item['assetCode']} · $statusLabel'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => onOpen(item['id'] as String),
                  ),
                );
              },
            ),
    );
  }
}

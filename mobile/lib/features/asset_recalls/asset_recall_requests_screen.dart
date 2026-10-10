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
  });

  final AssetRecallInitialTab initialTab;
  final AssetRecallsRepository? repository;

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
        _mine = results[0];
        _queue = results[1];
      });
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = recallErrorMessage(
          error.response?.data,
          'Không thể tải phiếu đổi tài sản.',
        );
      });
    }
  }

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
      title: const Text('Đổi tài sản'),
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
              _RecallList(items: _mine, onRefresh: _load, onOpen: _open),
              _RecallList(items: _queue, onRefresh: _load, onOpen: _open),
            ],
          ),
  );
}

class _RecallList extends StatelessWidget {
  const _RecallList({
    required this.items,
    required this.onRefresh,
    required this.onOpen,
  });

  final List<Map<String, dynamic>>? items;
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
              children: const [
                SizedBox(height: 160),
                Icon(Icons.inbox_outlined, size: 52),
                SizedBox(height: 12),
                Center(child: Text('Chưa có phiếu đổi tài sản.')),
              ],
            )
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: items!.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final item = items![index];

                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.swap_horiz),
                    title: Text(item['assetName'] as String? ?? 'Tài sản'),
                    subtitle: Text(
                      '${item['assetCode']} · ${assetRecallStatusLabel(item['status'] as String)}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => onOpen(item['id'] as String),
                  ),
                );
              },
            ),
    );
  }
}

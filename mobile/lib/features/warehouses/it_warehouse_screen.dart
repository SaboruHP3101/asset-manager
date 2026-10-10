import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../assets/asset_status_chip.dart';

class ItWarehouseScreen extends StatefulWidget {
  const ItWarehouseScreen({super.key});

  @override
  State<ItWarehouseScreen> createState() => _ItWarehouseScreenState();
}

class _ItWarehouseScreenState extends State<ItWarehouseScreen> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>>? _assets;
  String? _error;
  String? _status;

  List<Map<String, dynamic>> get _visibleAssets {
    final query = _searchController.text.trim().toLowerCase();

    return (_assets ?? const [])
        .where(
          (asset) =>
              (_status == null || asset['status'] == _status) &&
              (query.isEmpty ||
                  (asset['assetCode'] as String).toLowerCase().contains(
                    query,
                  ) ||
                  (asset['name'] as String? ?? '').toLowerCase().contains(
                    query,
                  )),
        )
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final response = await ApiClient.instance.dio.get<List<dynamic>>(
        '/warehouses/it/assets',
      );
      if (mounted) {
        setState(() {
          _assets = (response.data ?? const []).cast<Map<String, dynamic>>();
        });
      }
    } on DioException {
      if (mounted) setState(() => _error = 'Không thể tải tài sản kho IT.');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Kho IT')),
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
        : _assets == null
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                SearchBar(
                  controller: _searchController,
                  hintText: 'Tìm mã hoặc tên tài sản',
                  leading: const Icon(Icons.search),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterChip(
                        label: const Text('Tất cả'),
                        selected: _status == null,
                        onSelected: (_) => setState(() => _status = null),
                      ),
                      for (final status in {
                        for (final asset in _assets!) asset['status'] as String,
                      }) ...[
                        const SizedBox(width: 8),
                        FilterChip(
                          label: Text(assetStatusLabel(status)),
                          selected: _status == status,
                          onSelected: (_) => setState(() => _status = status),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if (_visibleAssets.isEmpty) ...[
                  const SizedBox(height: 120),
                  const Icon(Icons.warehouse_outlined, size: 52),
                  const SizedBox(height: 12),
                  const Center(child: Text('Không có tài sản phù hợp.')),
                ] else
                  for (final asset in _visibleAssets)
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.inventory_2_outlined),
                        title: Text(asset['name'] as String? ?? 'Tài sản'),
                        subtitle: Text(
                          '${asset['assetCode']} · ${asset['category']}',
                        ),
                        trailing: AssetStatusChip(
                          status: asset['status'] as String,
                          compact: true,
                        ),
                      ),
                    ),
              ],
            ),
          ),
  );
}

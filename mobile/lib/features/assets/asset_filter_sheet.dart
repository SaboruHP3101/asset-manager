import 'package:flutter/material.dart';

import 'asset_status_chip.dart';

class AssetFilterSheet extends StatefulWidget {
  const AssetFilterSheet({
    super.key,
    required this.categories,
    required this.assets,
    required this.initialCategoryId,
    required this.initialStatuses,
    required this.initialSort,
  });

  final List<Map<String, dynamic>> categories;
  final List<Map<String, dynamic>> assets;
  final String? initialCategoryId;
  final Set<String> initialStatuses;
  final String initialSort;

  @override
  State<AssetFilterSheet> createState() => _AssetFilterSheetState();
}

class _AssetFilterSheetState extends State<AssetFilterSheet> {
  late String? _categoryId = widget.initialCategoryId;
  late Set<String> _statuses = {...widget.initialStatuses};
  late String _sort = widget.initialSort;

  List<String> get _availableStatuses => {
    ...widget.assets.map(
      (asset) => assetStatusFilterKey(asset['status'] as String? ?? ''),
    ),
    ..._statuses,
  }.where((status) => status.isNotEmpty).toList();

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bộ lọc tài sản',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<String?>(
              initialValue: _categoryId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Danh mục',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(
                  value: null,
                  child: Text('Tất cả danh mục'),
                ),
                ...widget.categories.map(
                  (category) => DropdownMenuItem(
                    value: category['id'] as String,
                    child: Text(category['name'] as String),
                  ),
                ),
              ],
              onChanged: (value) => setState(() => _categoryId = value),
            ),
            if (_availableStatuses.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Trạng thái',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final status in _availableStatuses)
                    FilterChip(
                      label: Text(assetStatusLabel(status)),
                      selected: _statuses.contains(status),
                      onSelected: (selected) => setState(() {
                        selected
                            ? _statuses.add(status)
                            : _statuses.remove(status);
                      }),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            Text('Sắp xếp', style: Theme.of(context).textTheme.titleMedium),
            RadioGroup<String>(
              groupValue: _sort,
              onChanged: (value) => setState(() => _sort = value!),
              child: const Column(
                children: [
                  RadioListTile(
                    contentPadding: EdgeInsets.zero,
                    value: 'name_asc',
                    title: Text('Tên A–Z'),
                  ),
                  RadioListTile(
                    contentPadding: EdgeInsets.zero,
                    value: 'name_desc',
                    title: Text('Tên Z–A'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() {
                      _categoryId = null;
                      _statuses = {};
                      _sort = 'name_asc';
                    }),
                    child: const Text('Đặt lại'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(
                      context,
                      AssetFilters(
                        categoryId: _categoryId,
                        statuses: _statuses,
                        sort: _sort,
                      ),
                    ),
                    child: const Text('Áp dụng bộ lọc'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class AssetFilters {
  const AssetFilters({
    required this.categoryId,
    required this.statuses,
    required this.sort,
  });

  final String? categoryId;
  final Set<String> statuses;
  final String sort;
}

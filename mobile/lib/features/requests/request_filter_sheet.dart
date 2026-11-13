import 'package:flutter/material.dart';

import 'my_requests_data.dart';

class RequestFilters {
  const RequestFilters({
    required this.types,
    required this.statuses,
    required this.newestFirst,
  });

  final Set<MyRequestType> types;
  final Set<String> statuses;
  final bool newestFirst;
}

class RequestFilterSheet extends StatefulWidget {
  const RequestFilterSheet({
    super.key,
    required this.availableTypes,
    required this.availableStatuses,
    required this.initialTypes,
    required this.initialStatuses,
    required this.newestFirst,
  });

  final Set<MyRequestType> availableTypes;
  final Set<String> availableStatuses;
  final Set<MyRequestType> initialTypes;
  final Set<String> initialStatuses;
  final bool newestFirst;

  @override
  State<RequestFilterSheet> createState() => _RequestFilterSheetState();
}

class _RequestFilterSheetState extends State<RequestFilterSheet> {
  late Set<MyRequestType> _types;
  late Set<String> _statuses;
  late bool _newestFirst;

  @override
  void initState() {
    super.initState();
    _types = {...widget.initialTypes};
    _statuses = {...widget.initialStatuses};
    _newestFirst = widget.newestFirst;
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bộ lọc', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          Text('Loại yêu cầu', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final type in MyRequestType.values)
                if (widget.availableTypes.contains(type))
                  FilterChip(
                    label: Text(type.label),
                    selected: _types.contains(type),
                    onSelected: (selected) => setState(
                      () => selected ? _types.add(type) : _types.remove(type),
                    ),
                  ),
            ],
          ),
          const SizedBox(height: 16),
          Text('Trạng thái', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final status in widget.availableStatuses)
                FilterChip(
                  label: Text(status),
                  selected: _statuses.contains(status),
                  onSelected: (selected) => setState(
                    () => selected
                        ? _statuses.add(status)
                        : _statuses.remove(status),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: true, label: Text('Mới nhất')),
              ButtonSegment(value: false, label: Text('Cũ nhất')),
            ],
            selected: {_newestFirst},
            onSelectionChanged: (value) =>
                setState(() => _newestFirst = value.first),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() {
                    _types.clear();
                    _statuses.clear();
                    _newestFirst = true;
                  }),
                  child: const Text('Đặt lại'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.pop(
                    context,
                    RequestFilters(
                      types: _types,
                      statuses: _statuses,
                      newestFirst: _newestFirst,
                    ),
                  ),
                  child: const Text('Áp dụng'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

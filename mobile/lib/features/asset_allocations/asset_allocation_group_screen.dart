part of 'asset_allocation_queue_screen.dart';

class _AllocationGroupScreen extends StatefulWidget {
  const _AllocationGroupScreen({required this.group, required this.repository});

  final AssetAllocationGroup group;
  final AssetAllocationsRepository repository;

  @override
  State<_AllocationGroupScreen> createState() => _AllocationGroupScreenState();
}

class _AllocationGroupScreenState extends State<_AllocationGroupScreen> {
  final Set<String> _selectedIds = {};
  bool _busy = false;

  List<AssetAllocationTask> get _selected => widget.group.tasks
      .where((task) => _selectedIds.contains(_taskId(task)))
      .toList();

  String _taskId(AssetAllocationTask task) => task.allocationId ?? task.assetId;

  String _selectionKind(AssetAllocationTask task) =>
      '${task.queueType}:${task.decisionParty ?? ''}';

  List<MapEntry<String, List<AssetAllocationTask>>> get _sections {
    final sections = <String, List<AssetAllocationTask>>{};

    for (final task in widget.group.tasks) {
      sections.putIfAbsent(_selectionKind(task), () => []).add(task);
    }

    return sections.entries.toList();
  }

  void _toggle(AssetAllocationTask task, bool selected) {
    final current = _selected;
    if (selected &&
        current.isNotEmpty &&
        _selectionKind(current.first) != _selectionKind(task)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Chỉ chọn các tài sản có cùng bước xử lý.'),
        ),
      );
      return;
    }
    setState(() {
      if (selected) {
        _selectedIds.add(_taskId(task));
      } else {
        _selectedIds.remove(_taskId(task));
      }
    });
  }

  void _toggleAll(List<AssetAllocationTask> tasks) {
    final allSelected = tasks.every(
      (task) => _selectedIds.contains(_taskId(task)),
    );

    setState(() {
      if (allSelected) {
        _selectedIds.removeAll(tasks.map(_taskId));
        return;
      }

      _selectedIds
        ..clear()
        ..addAll(tasks.take(100).map(_taskId));
    });

    if (tasks.length > 100) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mỗi batch xử lý tối đa 100 tài sản.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selected;
    final isConfirmation =
        selected.isNotEmpty && selected.first.queueType == 'confirmation';

    return Scaffold(
      appBar: AppBar(title: Text(widget.group.requestCode)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 112),
        children: [
          _ProgressCard(group: widget.group),
          const SizedBox(height: 12),
          for (final section in _sections) ...[
            _SectionHeader(
              tasks: section.value,
              selectedIds: _selectedIds,
              disabled: _busy,
              taskId: _taskId,
              onToggleAll: () => _toggleAll(section.value),
            ),
            for (final task in section.value) ...[
              _AllocationTaskCard(
                task: task,
                selected: _selectedIds.contains(_taskId(task)),
                disabled: _busy,
                onChanged: (value) => _toggle(task, value),
              ),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 8),
          ],
        ],
      ),
      bottomNavigationBar: selected.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: isConfirmation
                    ? Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _busy ? null : () => _decide(false),
                              child: const Text('Từ chối đã chọn'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: FilledButton(
                              onPressed: _busy ? null : () => _decide(true),
                              child: _busy
                                  ? const ButtonSpinner()
                                  : Text('Xác nhận (${selected.length})'),
                            ),
                          ),
                        ],
                      )
                    : FilledButton.icon(
                        onPressed: _busy ? null : _allocate,
                        icon: _busy
                            ? const ButtonSpinner()
                            : const Icon(Icons.inventory_2_outlined),
                        label: Text(
                          selected.first.queueType == 'initial'
                              ? 'Cấp phát ${selected.length} tài sản'
                              : 'Phân bổ lại ${selected.length} tài sản',
                        ),
                      ),
              ),
            ),
    );
  }

  Future<void> _allocate() async {
    final tasks = _selected;
    final input = await Navigator.of(context).push<_AllocationInput>(
      MaterialPageRoute(
        builder: (_) =>
            _AllocationFormScreen(tasks: tasks, repository: widget.repository),
      ),
    );
    if (input == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await widget.repository.allocateBatch(
        tasks: tasks,
        targetType: input.targetType,
        recipientId: input.recipientId,
        departmentId: input.departmentId,
        location: input.location,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã gửi ${tasks.length} tài sản để xác nhận.')),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(assetAllocationApiError(error))));
    }
  }

  Future<void> _decide(bool confirmed) async {
    String? reason;
    if (!confirmed) {
      reason = await _rejectionReason(context);
      if (reason == null) return;
    }
    final tasks = _selected;
    setState(() => _busy = true);
    try {
      await widget.repository.decideBatch(
        tasks: tasks,
        confirmed: confirmed,
        reason: reason,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            confirmed
                ? 'Đã xác nhận ${tasks.length} tài sản.'
                : 'Đã từ chối ${tasks.length} tài sản.',
          ),
        ),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(assetAllocationApiError(error))));
    }
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.group});

  final AssetAllocationGroup group;

  @override
  Widget build(BuildContext context) => Card(
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tiến độ cấp phát',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          LinearProgressIndicator(value: group.progress),
          const SizedBox(height: 8),
          Text('${group.allocatedAssets}/${group.totalAssets} đã hoàn tất'),
          Text('${group.pendingAssets} tài sản chưa hoàn tất'),
        ],
      ),
    ),
  );
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.tasks,
    required this.selectedIds,
    required this.disabled,
    required this.taskId,
    required this.onToggleAll,
  });

  final List<AssetAllocationTask> tasks;
  final Set<String> selectedIds;
  final bool disabled;
  final String Function(AssetAllocationTask) taskId;
  final VoidCallback onToggleAll;

  @override
  Widget build(BuildContext context) {
    final first = tasks.first;
    final allSelected = tasks.every(
      (task) => selectedIds.contains(taskId(task)),
    );
    final title = switch (first.queueType) {
      'initial' => 'Chờ cấp phát',
      'reallocation' => 'Chờ phân bổ lại',
      _ when first.decisionParty == 'recipient' => 'Chờ người nhận xác nhận',
      _ => 'Chờ Trưởng phòng xác nhận',
    };

    return Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        TextButton.icon(
          key: ValueKey('toggle-all-${first.queueType}-${first.decisionParty}'),
          onPressed: disabled ? null : onToggleAll,
          icon: Icon(
            allSelected ? Icons.deselect_outlined : Icons.select_all_outlined,
          ),
          label: Text(allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'),
        ),
      ],
    );
  }
}

class _AllocationTaskCard extends StatelessWidget {
  const _AllocationTaskCard({
    required this.task,
    required this.selected,
    required this.disabled,
    required this.onChanged,
  });

  final AssetAllocationTask task;
  final bool selected;
  final bool disabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: disabled ? null : () => onChanged(!selected),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: selected,
              onChanged: disabled ? null : (value) => onChanged(value ?? false),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.assetName,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    task.assetCode,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: _QueueChip(type: task.queueType),
                  ),
                  if (task.targetType == 'shared_location') ...[
                    const SizedBox(height: 6),
                    const Text('Đích sử dụng: Vị trí dùng chung'),
                  ],
                  if (task.recipientName != null) ...[
                    const SizedBox(height: 6),
                    Text('Người nhận: ${task.recipientName}'),
                  ],
                  if (task.location != null) ...[
                    const SizedBox(height: 4),
                    Text('Vị trí: ${task.location}'),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _QueueChip extends StatelessWidget {
  const _QueueChip({required this.type});
  final String type;

  @override
  Widget build(BuildContext context) {
    final (icon, label) = switch (type) {
      'initial' => (Icons.inventory_2_outlined, 'Chờ cấp phát'),
      'reallocation' => (Icons.swap_horiz, 'Phân bổ lại'),
      _ => (Icons.schedule_outlined, 'Chờ xác nhận'),
    };

    return StatusChip(icon: icon, label: label, compact: true);
  }
}

Future<String?> _rejectionReason(BuildContext context) async {
  final controller = TextEditingController();
  final reason = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Lý do từ chối'),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLines: 3,
        decoration: textareaDecoration(
          context,
          const InputDecoration(
            labelText: 'Lý do bắt buộc',
            border: OutlineInputBorder(),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: () {
            final value = controller.text.trim();
            if (value.isNotEmpty) Navigator.pop(context, value);
          },
          child: const Text('Từ chối'),
        ),
      ],
    ),
  );
  controller.dispose();

  return reason;
}

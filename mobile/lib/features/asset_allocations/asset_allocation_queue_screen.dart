import 'package:flutter/material.dart';

import '../../core/utils/department_labels.dart';
import 'asset_allocation_models.dart';
import 'asset_allocations_repository.dart';

class AssetAllocationQueueScreen extends StatefulWidget {
  const AssetAllocationQueueScreen({super.key, this.repository});

  final AssetAllocationsRepository? repository;

  @override
  State<AssetAllocationQueueScreen> createState() =>
      _AssetAllocationQueueScreenState();
}

class _AssetAllocationQueueScreenState
    extends State<AssetAllocationQueueScreen> {
  late final AssetAllocationsRepository _repository;
  List<AssetAllocationGroup>? _groups;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? AssetAllocationsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _groups = null;
      _error = null;
    });
    try {
      final tasks = await _repository.findQueue();
      if (mounted) setState(() => _groups = groupAllocationTasks(tasks));
    } catch (error) {
      if (mounted) setState(() => _error = assetAllocationApiError(error));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Cấp phát tài sản'), centerTitle: true),
    body: _error != null
        ? _MessageState(message: _error!, onRetry: _load)
        : _groups == null
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _load,
            child: _groups!.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 140),
                      Icon(Icons.assignment_turned_in_outlined, size: 56),
                      SizedBox(height: 12),
                      Text(
                        'Không có đề nghị cần cấp phát.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _groups!.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, index) => _GroupCard(
                      group: _groups![index],
                      onTap: () async {
                        final changed = await Navigator.of(context).push<bool>(
                          MaterialPageRoute(
                            builder: (_) => _AllocationGroupScreen(
                              group: _groups![index],
                              repository: _repository,
                            ),
                          ),
                        );
                        if (changed == true && mounted) await _load();
                      },
                    ),
                  ),
          ),
  );
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.onTap});

  final AssetAllocationGroup group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    group.requestCode,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
            const SizedBox(height: 10),
            LinearProgressIndicator(value: group.progress),
            const SizedBox(height: 8),
            Text(
              '${group.allocatedAssets}/${group.totalAssets} tài sản đã cấp phát'
              ' · ${group.tasks.length} việc cần xử lý',
            ),
          ],
        ),
      ),
    ),
  );
}

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
                                  ? const _ButtonLoader()
                                  : Text('Xác nhận (${selected.length})'),
                            ),
                          ),
                        ],
                      )
                    : FilledButton.icon(
                        onPressed: _busy ? null : _allocate,
                        icon: _busy
                            ? const _ButtonLoader()
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
      borderRadius: BorderRadius.circular(12),
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

class _AllocationFormScreen extends StatefulWidget {
  const _AllocationFormScreen({required this.tasks, required this.repository});

  final List<AssetAllocationTask> tasks;
  final AssetAllocationsRepository repository;

  @override
  State<_AllocationFormScreen> createState() => _AllocationFormScreenState();
}

class _AllocationFormScreenState extends State<_AllocationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _location = TextEditingController();
  List<AllocationDepartment>? _departments;
  List<AllocationRecipient>? _recipients;
  String _targetType = 'individual';
  String? _departmentId;
  String? _recipientId;
  String? _error;

  AssetAllocationTask get _first => widget.tasks.first;

  @override
  void initState() {
    super.initState();
    _loadDepartments();
  }

  @override
  void dispose() {
    _location.dispose();
    super.dispose();
  }

  Future<void> _loadDepartments() async {
    try {
      final departments = await widget.repository.findDepartments();
      final initialId = _first.queueType == 'initial'
          ? _first.requestDepartmentId
          : null;
      if (!mounted) return;
      setState(() {
        _departments = departments;
        _departmentId = initialId;
      });
      if (initialId != null) await _loadRecipients(initialId);
    } catch (error) {
      if (mounted) setState(() => _error = assetAllocationApiError(error));
    }
  }

  Future<void> _loadRecipients(String departmentId) async {
    setState(() {
      _departmentId = departmentId;
      _recipientId = null;
      _recipients = null;
    });
    try {
      final recipients = await widget.repository.findRecipients(departmentId);
      if (mounted) setState(() => _recipients = recipients);
    } catch (error) {
      if (mounted) setState(() => _error = assetAllocationApiError(error));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Cấp phát ${widget.tasks.length} tài sản')),
    body: _error != null
        ? _MessageState(message: _error!, onRetry: _loadDepartments)
        : _departments == null
        ? const Center(child: CircularProgressIndicator())
        : Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '${widget.tasks.length} tài sản đã chọn',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(widget.tasks.map((task) => task.assetCode).join(', ')),
                const SizedBox(height: 16),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: 'individual',
                      icon: Icon(Icons.person_outline),
                      label: Text('Cá nhân'),
                    ),
                    ButtonSegment(
                      value: 'shared_location',
                      icon: Icon(Icons.meeting_room_outlined),
                      label: Text('Vị trí dùng chung'),
                    ),
                  ],
                  selected: {_targetType},
                  onSelectionChanged: (values) => setState(() {
                    _targetType = values.first;
                    _recipientId = null;
                  }),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _departmentId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Phòng ban sử dụng',
                    border: OutlineInputBorder(),
                  ),
                  items: _departments!
                      .map(
                        (item) => DropdownMenuItem(
                          value: item.id,
                          child: Text(departmentLabel(item.name) ?? item.name),
                        ),
                      )
                      .toList(),
                  onChanged: _first.queueType == 'initial'
                      ? null
                      : (value) {
                          if (value != null) _loadRecipients(value);
                        },
                  validator: (value) => value == null ? 'Chọn phòng ban' : null,
                ),
                if (_targetType == 'individual') ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _recipientId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: 'Người nhận',
                      border: const OutlineInputBorder(),
                      suffixIcon: _departmentId != null && _recipients == null
                          ? const Padding(
                              padding: EdgeInsets.all(14),
                              child: SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            )
                          : null,
                    ),
                    items: (_recipients ?? [])
                        .map(
                          (item) => DropdownMenuItem(
                            value: item.id,
                            child: Text(
                              item.fullName,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: _recipients == null
                        ? null
                        : (value) => setState(() => _recipientId = value),
                    validator: (value) =>
                        value == null ? 'Chọn người nhận' : null,
                  ),
                ],
                const SizedBox(height: 12),
                TextFormField(
                  controller: _location,
                  decoration: InputDecoration(
                    labelText: _targetType == 'shared_location'
                        ? 'Vị trí dùng chung'
                        : 'Vị trí sử dụng',
                    hintText: _targetType == 'shared_location'
                        ? 'Ví dụ: Phòng họp 5'
                        : 'Ví dụ: Tầng 3 - Bàn A12',
                    border: const OutlineInputBorder(),
                  ),
                  maxLength: 500,
                  validator: (value) => value?.trim().isEmpty ?? true
                      ? 'Nhập vị trí sử dụng'
                      : null,
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () {
                    if (!_formKey.currentState!.validate()) return;
                    Navigator.pop(
                      context,
                      _AllocationInput(
                        targetType: _targetType,
                        departmentId: _departmentId!,
                        recipientId: _targetType == 'individual'
                            ? _recipientId
                            : null,
                        location: _location.text.trim(),
                      ),
                    );
                  },
                  child: const Text('Gửi xác nhận'),
                ),
              ],
            ),
          ),
  );
}

class _AllocationInput {
  const _AllocationInput({
    required this.targetType,
    required this.departmentId,
    required this.recipientId,
    required this.location,
  });

  final String targetType;
  final String departmentId;
  final String? recipientId;
  final String location;
}

class _QueueChip extends StatelessWidget {
  const _QueueChip({required this.type});
  final String type;

  @override
  Widget build(BuildContext context) => Chip(
    label: Text(switch (type) {
      'initial' => 'Chờ cấp phát',
      'reallocation' => 'Phân bổ lại',
      _ => 'Chờ xác nhận',
    }),
  );
}

class _ButtonLoader extends StatelessWidget {
  const _ButtonLoader();

  @override
  Widget build(BuildContext context) => const SizedBox.square(
    dimension: 18,
    child: CircularProgressIndicator(strokeWidth: 2),
  );
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
        decoration: const InputDecoration(
          labelText: 'Lý do bắt buộc',
          border: OutlineInputBorder(),
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

class _MessageState extends StatelessWidget {
  const _MessageState({required this.message, required this.onRetry});
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

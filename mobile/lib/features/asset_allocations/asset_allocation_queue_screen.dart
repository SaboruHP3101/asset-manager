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
  List<AssetAllocationTask>? _tasks;
  String? _error;
  String? _actingId;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? AssetAllocationsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _tasks = null;
      _error = null;
    });
    try {
      final tasks = await _repository.findQueue();
      if (mounted) setState(() => _tasks = tasks);
    } catch (error) {
      if (mounted) setState(() => _error = assetAllocationApiError(error));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Cấp phát tài sản'), centerTitle: true),
    body: _error != null
        ? _MessageState(message: _error!, onRetry: _load)
        : _tasks == null
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _load,
            child: _tasks!.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 140),
                      Icon(Icons.assignment_turned_in_outlined, size: 56),
                      SizedBox(height: 12),
                      Text(
                        'Không có tài sản cần xử lý.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _tasks!.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, index) => _taskCard(_tasks![index]),
                  ),
          ),
  );

  Widget _taskCard(AssetAllocationTask task) {
    final confirming = task.queueType == 'confirmation';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    task.assetName,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                _QueueChip(type: task.queueType),
              ],
            ),
            Text(task.assetCode),
            if (task.requestCode != null) Text('Đề nghị ${task.requestCode}'),
            if (task.recipientName != null)
              Text('Người nhận: ${task.recipientName}'),
            if (task.location != null) Text('Vị trí: ${task.location}'),
            if (confirming) ...[
              const SizedBox(height: 8),
              _DecisionStatus(
                label: 'Trưởng phòng',
                value: task.departmentHeadDecision!,
              ),
              _DecisionStatus(
                label: 'Người nhận',
                value: task.recipientDecision!,
              ),
            ],
            const SizedBox(height: 10),
            if (confirming)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _actingId == null
                          ? () => _decide(task, confirmed: false)
                          : null,
                      child: const Text('Từ chối'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: _actingId == null
                          ? () => _decide(task, confirmed: true)
                          : null,
                      child: _actingId == task.allocationId
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Xác nhận'),
                    ),
                  ),
                ],
              )
            else
              FilledButton.icon(
                onPressed: _actingId == null ? () => _allocate(task) : null,
                icon: const Icon(Icons.person_add_alt_1_outlined),
                label: Text(
                  task.queueType == 'initial' ? 'Cấp phát' : 'Phân bổ lại',
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _allocate(AssetAllocationTask task) async {
    final input = await Navigator.of(context).push<_AllocationInput>(
      MaterialPageRoute(
        builder: (_) =>
            _AllocationFormScreen(task: task, repository: _repository),
      ),
    );
    if (input == null) return;
    setState(() => _actingId = task.assetId);
    try {
      await _repository.allocate(
        task: task,
        recipientId: input.recipientId,
        departmentId: input.departmentId,
        location: input.location,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi cấp phát để xác nhận.')),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      setState(() => _actingId = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(assetAllocationApiError(error))));
    }
  }

  Future<void> _decide(
    AssetAllocationTask task, {
    required bool confirmed,
  }) async {
    String? reason;
    if (!confirmed) {
      reason = await _rejectionReason();
      if (reason == null) return;
    }
    setState(() => _actingId = task.allocationId);
    try {
      await _repository.decide(
        task: task,
        confirmed: confirmed,
        reason: reason,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            confirmed ? 'Đã xác nhận cấp phát.' : 'Đã từ chối cấp phát.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      setState(() => _actingId = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(assetAllocationApiError(error))));
    }
  }

  Future<String?> _rejectionReason() async {
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
}

class _AllocationFormScreen extends StatefulWidget {
  const _AllocationFormScreen({required this.task, required this.repository});

  final AssetAllocationTask task;
  final AssetAllocationsRepository repository;

  @override
  State<_AllocationFormScreen> createState() => _AllocationFormScreenState();
}

class _AllocationFormScreenState extends State<_AllocationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _location = TextEditingController();
  List<AllocationDepartment>? _departments;
  List<AllocationRecipient>? _recipients;
  String? _departmentId;
  String? _recipientId;
  String? _error;

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
      final initialId = widget.task.queueType == 'initial'
          ? widget.task.requestDepartmentId
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
    appBar: AppBar(title: Text('Cấp phát ${widget.task.assetCode}')),
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
                  widget.task.assetName,
                  style: Theme.of(context).textTheme.titleLarge,
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
                  onChanged: widget.task.queueType == 'initial'
                      ? null
                      : (value) {
                          if (value != null) _loadRecipients(value);
                        },
                  validator: (value) => value == null ? 'Chọn phòng ban' : null,
                ),
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
                              child: CircularProgressIndicator(strokeWidth: 2),
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
                if (_recipients?.isEmpty ?? false)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text('Phòng ban này không có nhân viên hoạt động.'),
                  ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _location,
                  decoration: const InputDecoration(
                    labelText: 'Vị trí sử dụng',
                    hintText: 'Ví dụ: Tầng 3 - Bàn A12',
                    border: OutlineInputBorder(),
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
                        departmentId: _departmentId!,
                        recipientId: _recipientId!,
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
    required this.departmentId,
    required this.recipientId,
    required this.location,
  });

  final String departmentId;
  final String recipientId;
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

class _DecisionStatus extends StatelessWidget {
  const _DecisionStatus({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(
        value == 'confirmed' ? Icons.check_circle : Icons.schedule,
        size: 18,
        color: value == 'confirmed'
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.outline,
      ),
      const SizedBox(width: 6),
      Text('$label: ${value == 'confirmed' ? 'Đã xác nhận' : 'Đang chờ'}'),
    ],
  );
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

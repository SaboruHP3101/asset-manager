part of 'asset_allocation_queue_screen.dart';

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
        ? RetryMessage(message: _error!, onRetry: _loadDepartments)
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
                              child: ButtonSpinner(),
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

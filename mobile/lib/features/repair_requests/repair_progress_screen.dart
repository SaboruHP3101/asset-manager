import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../core/widgets/vertical_timeline.dart';
import 'repair_request_form.dart';

class RepairProgressScreen extends StatefulWidget {
  const RepairProgressScreen({this.assetId, this.requestId, super.key})
    : assert(assetId != null || requestId != null);

  final String? assetId;
  final String? requestId;

  @override
  State<RepairProgressScreen> createState() => _RepairProgressScreenState();
}

class _RepairProgressScreenState extends State<RepairProgressScreen> {
  final _dio = ApiClient.instance.dio;
  Map<String, dynamic>? _data;
  String? _error;
  bool _acting = false;

  @override
  void initState() {
    super.initState();
    _loadProgress();
  }

  // Tải tiến trình theo mã yêu cầu hoặc theo tài sản được truyền vào.
  Future<void> _loadProgress() async {
    setState(() => _error = null);
    try {
      final endpoint = widget.requestId != null
          ? '/repair-requests/${widget.requestId}'
          : '/repair-requests/mine/asset/${widget.assetId}';
      final response = await _dio.get<Map<String, dynamic>>(endpoint);
      if (!mounted) return;
      final value = response.data;
      setState(() {
        _data = widget.requestId == null || value == null
            ? value
            : {'request': value, 'timeline': value['timeline'] ?? const []};
      });
    } on DioException {
      if (mounted) {
        setState(() => _error = 'Không thể tải tiến trình sửa chữa.');
      }
    }
  }

  String _statusText(String status) {
    const labels = {
      'draft': 'Bản nháp',
      'pending_department_head': 'Chờ Trưởng bộ phận',
      'pending_it_head': 'Chờ Trưởng IT',
      'revision_required': 'Cần chỉnh sửa',
      'pending_handover_confirmations': 'Chờ xác nhận bàn giao',
      'reported': 'Đã tiếp nhận',
      'assessed': 'Đã đánh giá',
      'approval_pending': 'Đang chờ duyệt',
      'in_progress': 'Đang sửa chữa',
      'ready_for_return': 'Chờ nhận lại tài sản',
      'completed': 'Chờ nghiệm thu',
      'confirmed': 'Đã nghiệm thu',
      'rejected': 'Yêu cầu làm lại',
      'closed': 'Đã kết thúc',
      'cancelled': 'Đã hủy',
    };
    return labels[status] ?? status.replaceAll('_', ' ');
  }

  String _actionText(String action) {
    const labels = {
      'repair.draft_created': 'Nhân viên đã tạo bản nháp',
      'repair.draft_updated': 'Nhân viên đã cập nhật phiếu',
      'repair.submitted': 'Nhân viên đã gửi phiếu',
      'repair.department_decision': 'Trưởng bộ phận đã xử lý phiếu',
      'repair.it_decision': 'Trưởng IT đã xử lý phiếu',
      'repair.employee_handover_confirmed': 'Nhân viên đã xác nhận bàn giao',
      'repair.it_handover_confirmed': 'Trưởng IT đã xác nhận bàn giao',
      'repair.employee_handover_rejected': 'Nhân viên đã từ chối bàn giao',
      'repair.it_handover_rejected': 'Trưởng IT đã từ chối bàn giao',
      'repair.received': 'Tài sản đã được nhận vào kho IT',
      'reported': 'Đã gửi yêu cầu sửa chữa',
      'assessed': 'IT đã đánh giá tình trạng',
      'approval_confirmed': 'Trưởng bộ phận đã phê duyệt',
      'cancelled': 'Yêu cầu đã bị từ chối',
      'assigned': 'Đã phân công kỹ thuật viên',
      'completed': 'Đã hoàn thành sửa chữa',
      'confirmed': 'Người dùng đã nghiệm thu',
      'rejected': 'Người dùng yêu cầu xử lý lại',
    };
    return labels[action] ?? action.replaceAll('_', ' ');
  }

  String? _formatTime(Object? value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (date == null) return null;
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(date.day)}/${two(date.month)}/${date.year} '
        '${two(date.hour)}:${two(date.minute)}';
  }

  List<TimelineStep> _steps(Map<String, dynamic> data) {
    final request = data['request'] as Map<String, dynamic>;
    final events = (data['timeline'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final terminal =
        request['status'] == 'closed' || request['status'] == 'cancelled';

    return events.asMap().entries.map((entry) {
      final event = entry.value;
      final rejected = event['status'] == 'rejected';
      return TimelineStep(
        title: _actionText(event['actionType']?.toString() ?? ''),
        subtitle:
            event['notes']?.toString() ??
            'Thực hiện bởi ${event['approverRole']}',
        time: _formatTime(event['createdAt']),
        state: rejected
            ? TimelineStepState.rejected
            : (!terminal && entry.key == events.length - 1)
            ? TimelineStepState.current
            : TimelineStepState.completed,
      );
    }).toList();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _acting = true);
    try {
      await action();
      await _loadProgress();
    } on DioException catch (error) {
      if (!mounted) return;
      final data = error.response?.data;
      final message = data is Map ? data['message']?.toString() : null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message ?? 'Không thể xử lý phiếu.')),
      );
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<String?> _textDialog(String title, String label) async {
    var value = '';

    return showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(title),
          content: TextField(
            autofocus: true,
            minLines: 3,
            maxLines: 6,
            onChanged: (text) => setDialogState(() => value = text.trim()),
            decoration: InputDecoration(
              labelText: label,
              border: const OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: value.isEmpty
                  ? null
                  : () => Navigator.pop(context, value),
              child: const Text('Xác nhận'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _decision(String endpoint, bool approved) async {
    String? note;
    if (!approved) {
      note = await _textDialog('Trả phiếu về chỉnh sửa', 'Lý do');
      if (note == null) return;
    }
    await _run(
      () =>
          _dio.post<void>(endpoint, data: {'approved': approved, 'note': note}),
    );
  }

  Future<String?> _selectAssignee() async {
    try {
      final response = await _dio.get<List<dynamic>>(
        '/repair-requests/it-assignees',
      );
      final employees = (response.data ?? const [])
          .cast<Map<String, dynamic>>();
      if (!mounted || employees.isEmpty) return null;
      String? selectedId;

      return await showDialog<String>(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: const Text('Phân công kỹ thuật viên'),
            content: DropdownButtonFormField<String>(
              initialValue: selectedId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Nhân viên IT',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final employee in employees)
                  DropdownMenuItem(
                    value: employee['id'] as String,
                    child: Text(
                      employee['name'] as String? ??
                          employee['email'] as String,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (value) => setDialogState(() => selectedId = value),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Hủy'),
              ),
              FilledButton(
                onPressed: selectedId == null
                    ? null
                    : () => Navigator.pop(context, selectedId),
                child: const Text('Phân công'),
              ),
            ],
          ),
        ),
      );
    } on DioException {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể tải nhân viên IT.')),
        );
      }

      return null;
    }
  }

  Widget? _actions(Map<String, dynamic> request) {
    if (_acting) return const Center(child: CircularProgressIndicator());
    final actions = (request['allowedActions'] as List<dynamic>? ?? const [])
        .cast<String>();
    final id = request['id'] as String;

    if (actions.contains('repair.update')) {
      return FilledButton(
        onPressed: () async {
          final result = await Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder: (_) => RepairRequestForm(
                initialAssetId: request['assetId'] as String,
                requestId: id,
                initialDescription:
                    request['issueDescription'] as String? ?? '',
                revisionRequired: request['status'] == 'revision_required',
              ),
            ),
          );
          if (result == true) await _loadProgress();
        },
        child: const Text('Tiếp tục phiếu'),
      );
    }

    if (actions.contains('repair.approve_department')) {
      return _DecisionButtons(
        approveLabel: 'Duyệt & gửi IT',
        onApprove: () =>
            _decision('/repair-requests/$id/department-decision', true),
        onReject: () =>
            _decision('/repair-requests/$id/department-decision', false),
      );
    }

    if (actions.contains('repair.approve_it')) {
      return _DecisionButtons(
        approveLabel: 'Duyệt sửa chữa',
        onApprove: () => _decision('/repair-requests/$id/it-decision', true),
        onReject: () => _decision('/repair-requests/$id/it-decision', false),
      );
    }

    if (actions.contains('repair.confirm_handover')) {
      return _DecisionButtons(
        approveLabel: 'Xác nhận bàn giao',
        onApprove: () => _run(
          () => _dio.post<void>(
            '/repair-requests/$id/handover-decision',
            data: {'confirmed': true},
          ),
        ),
        onReject: () async {
          final note = await _textDialog('Từ chối bàn giao', 'Lý do');
          if (note != null) {
            await _run(
              () => _dio.post<void>(
                '/repair-requests/$id/handover-decision',
                data: {'confirmed': false, 'note': note},
              ),
            );
          }
        },
      );
    }

    if (actions.contains('repair.complete')) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (actions.contains('repair.assign')) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () async {
                  final assigneeId = await _selectAssignee();
                  if (assigneeId != null) {
                    await _run(
                      () => _dio.post<void>(
                        '/repair-requests/$id/assign',
                        data: {'assignedTo': assigneeId},
                      ),
                    );
                  }
                },
                child: const Text('Phân công kỹ thuật viên'),
              ),
            ),
            const SizedBox(height: 8),
          ],
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () async {
                final result = await _textDialog(
                  'Hoàn tất sửa chữa',
                  'Kết quả sửa chữa',
                );
                if (result != null) {
                  await _run(
                    () => _dio.post<void>(
                      '/repair-requests/$id/complete',
                      data: {'resultNotes': result},
                    ),
                  );
                }
              },
              child: const Text('Hoàn tất sửa chữa'),
            ),
          ),
        ],
      );
    }

    if (actions.contains('repair.confirm_result')) {
      return _DecisionButtons(
        approveLabel: 'Xác nhận nhận tài sản',
        onApprove: () => _run(
          () => _dio.post<void>(
            '/repair-requests/$id/confirm-result',
            data: {'accepted': true},
          ),
        ),
        onReject: () async {
          final note = await _textDialog('Yêu cầu IT sửa lại', 'Lý do');
          if (note != null) {
            await _run(
              () => _dio.post<void>(
                '/repair-requests/$id/confirm-result',
                data: {'accepted': false, 'note': note},
              ),
            );
          }
        },
      );
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final request = data?['request'] as Map<String, dynamic>?;
    final actionArea = request == null ? null : _actions(request);
    return Scaffold(
      appBar: AppBar(title: const Text('Tiến trình sửa chữa')),
      body: data == null
          ? Center(
              child: _error == null
                  ? const CircularProgressIndicator()
                  : FilledButton.tonal(
                      onPressed: _loadProgress,
                      child: const Text('Thử lại'),
                    ),
            )
          : RefreshIndicator(
              onRefresh: _loadProgress,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.build_circle_outlined),
                      title: Text(_statusText(data['request']['status'])),
                      subtitle: Text(data['request']['issueDescription'] ?? ''),
                    ),
                  ),
                  const SizedBox(height: 24),
                  VerticalTimeline(steps: _steps(data)),
                  if (actionArea != null) ...[
                    const SizedBox(height: 24),
                    actionArea,
                  ],
                ],
              ),
            ),
    );
  }
}

class _DecisionButtons extends StatelessWidget {
  const _DecisionButtons({
    required this.approveLabel,
    required this.onApprove,
    required this.onReject,
  });

  final String approveLabel;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: OutlinedButton(
          onPressed: onReject,
          child: const Text('Từ chối'),
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: FilledButton(onPressed: onApprove, child: Text(approveLabel)),
      ),
    ],
  );
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/utils/department_labels.dart';
import 'asset_recall_form.dart';
import 'asset_recall_models.dart';
import 'asset_recalls_repository.dart';

class AssetRecallDetailScreen extends StatefulWidget {
  const AssetRecallDetailScreen({
    required this.requestId,
    super.key,
    this.repository,
  });

  final String requestId;
  final AssetRecallsRepository? repository;

  @override
  State<AssetRecallDetailScreen> createState() =>
      _AssetRecallDetailScreenState();
}

class _AssetRecallDetailScreenState extends State<AssetRecallDetailScreen> {
  late final AssetRecallsRepository _repository;
  Map<String, dynamic>? _request;
  String? _error;
  bool _acting = false;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? AssetRecallsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final request = await _repository.findOne(widget.requestId);
      if (mounted) setState(() => _request = request);
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

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _acting = true);
    try {
      await action();
      await _load();
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            recallErrorMessage(error.response?.data, 'Không thể xử lý phiếu.'),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<String?> _reasonDialog(String title) async {
    var reason = '';

    return showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(title),
          content: TextField(
            autofocus: true,
            minLines: 3,
            maxLines: 5,
            onChanged: (value) => setDialogState(() => reason = value.trim()),
            decoration: const InputDecoration(
              labelText: 'Lý do',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: reason.isEmpty
                  ? null
                  : () => Navigator.pop(context, reason),
              child: const Text('Xác nhận'),
            ),
          ],
        ),
      ),
    );
  }

  Future<String?> _selectReplacement() async {
    List<Map<String, dynamic>> candidates;

    try {
      candidates = await _repository.findExchangeCandidates();
    } on DioException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              recallErrorMessage(
                error.response?.data,
                'Không thể tải tài sản trong kho IT.',
              ),
            ),
          ),
        );
      }

      return null;
    }
    if (!mounted) return null;
    if (candidates.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kho IT chưa có tài sản sẵn sàng.')),
      );
      return null;
    }

    String? selectedId;

    return showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Chọn tài sản thay thế'),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Tài sản trong kho IT',
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    for (final asset in candidates)
                      DropdownMenuItem(
                        value: asset['id'] as String,
                        child: Text(
                          '${asset['assetCode']} · ${asset['name'] ?? asset['category']}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => selectedId = value),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Khi duyệt, Trưởng IT xác nhận tài sản thay thế có giá trị quy đổi tương đương.',
                ),
              ],
            ),
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
              child: const Text('Chọn & duyệt'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _edit() async {
    final request = _request!;
    final asset = Map<String, dynamic>.from(request['asset'] as Map);
    final result = await Navigator.of(context).push<AssetRecallFormResult>(
      MaterialPageRoute(
        builder: (_) => AssetRecallForm(
          assetId: asset['id'] as String,
          assetName: asset['name'] as String? ?? asset['assetCode'] as String,
          assetCode: asset['assetCode'] as String?,
          assetCategory: asset['category'] as String?,
          assetLocation: asset['currentLocation'] as String?,
          requestId: request['id'] as String,
          initialReason: request['reason'] as String? ?? '',
          revisionRequired: request['status'] == 'revision_required',
          repository: _repository,
        ),
      ),
    );
    if (result != null) await _load();
  }

  List<String> get _actions =>
      (_request?['allowedActions'] as List<dynamic>? ?? const [])
          .cast<String>();

  Widget? _actionArea() {
    if (_acting) {
      return const Padding(
        padding: EdgeInsets.all(18),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_actions.contains('asset.recall.update')) {
      return _ActionPrompt(
        message:
            'Cập nhật nội dung và gửi lại phiếu để bắt đầu vòng duyệt mới.',
        child: _SingleAction(label: 'Tiếp tục phiếu', onPressed: _edit),
      );
    }

    if (_actions.contains('asset.recall.approve_department')) {
      return _ActionPrompt(
        message: 'Bạn cần duyệt nhu cầu trước khi chuyển phiếu đến Trưởng IT.',
        child: _DecisionActions(
          approveLabel: 'Duyệt & gửi IT',
          onApprove: () => _run(
            () =>
                _repository.decideDepartment(widget.requestId, approved: true),
          ),
          onReject: () async {
            final reason = await _reasonDialog('Trả phiếu về chỉnh sửa');
            if (reason != null) {
              await _run(
                () => _repository.decideDepartment(
                  widget.requestId,
                  approved: false,
                  reason: reason,
                ),
              );
            }
          },
        ),
      );
    }

    if (_actions.contains('asset.recall.approve_it')) {
      return _ActionPrompt(
        message: 'Chọn tài sản tương đương trong kho IT trước khi duyệt.',
        child: _DecisionActions(
          approveLabel: 'Chọn tài sản & duyệt',
          onApprove: () async {
            final replacementId = await _selectReplacement();
            if (replacementId != null) {
              await _run(
                () => _repository.decideIt(
                  widget.requestId,
                  approved: true,
                  replacementAssetId: replacementId,
                ),
              );
            }
          },
          onReject: () async {
            final reason = await _reasonDialog('Trả phiếu về chỉnh sửa');
            if (reason != null) {
              await _run(
                () => _repository.decideIt(
                  widget.requestId,
                  approved: false,
                  reason: reason,
                ),
              );
            }
          },
        ),
      );
    }

    if (_actions.contains('asset.recall.confirm_handover')) {
      return _ActionPrompt(
        message: 'Xác nhận sau khi tài sản cũ và tài sản thay thế đã được bàn giao thực tế.',
        child: _DecisionActions(
          approveLabel: 'Xác nhận bàn giao',
          onApprove: () => _run(
            () => _repository.decideHandover(widget.requestId, confirmed: true),
          ),
          onReject: () async {
            final reason = await _reasonDialog('Từ chối bàn giao');
            if (reason != null) {
              await _run(
                () => _repository.decideHandover(
                  widget.requestId,
                  confirmed: false,
                  reason: reason,
                ),
              );
            }
          },
        ),
      );
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final request = _request;
    if (request == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Phiếu đổi tài sản')),
        body: Center(
          child: _error == null
              ? const CircularProgressIndicator()
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
        ),
      );
    }

    final asset = Map<String, dynamic>.from(request['asset'] as Map);
    final replacement = request['replacementAsset'] == null
        ? null
        : Map<String, dynamic>.from(request['replacementAsset'] as Map);
    final requester = Map<String, dynamic>.from(request['requester'] as Map);
    final department = Map<String, dynamic>.from(request['department'] as Map);
    final trail = (request['trail'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final actionArea = _actionArea();
    final status = request['status'] as String;

    return Scaffold(
      appBar: AppBar(title: const Text('Phiếu đổi tài sản')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _StatusBanner(
              status: status,
              nextStep: _nextStep(status, _actions),
              rejectionReason: _rejectionReason(request),
            ),
            const SizedBox(height: 12),
            _ApprovalSummary(request: request),
            const SizedBox(height: 12),
            _AssetComparison(original: asset, replacement: replacement),
            const SizedBox(height: 12),
            _Section(
              title: 'Thông tin đề nghị',
              children: [
                _Row(label: 'Người gửi', value: requester['name'] as String),
                _Row(
                  label: 'Bộ phận',
                  value:
                      departmentLabel(department['name'] as String?) ??
                      department['name'] as String,
                ),
                _Row(
                  label: 'Lý do',
                  value: request['reason'] as String? ?? '—',
                ),
              ],
            ),
            if (replacement != null) ...[
              const SizedBox(height: 12),
              _Section(
                title: 'Tài sản thay thế',
                children: [
                  _Row(
                    label: 'Tài sản',
                    value: replacement['name'] as String? ?? '—',
                  ),
                  _Row(
                    label: 'Mã tài sản',
                    value: replacement['assetCode'] as String,
                  ),
                ],
              ),
            ],
            if (trail.isNotEmpty) ...[
              const SizedBox(height: 12),
              _Section(
                title: 'Lịch sử xử lý',
                children: [
                  for (final entry in trail)
                    ListTile(
                      dense: true,
                      leading: const Icon(Icons.history, size: 20),
                      title: Text(_auditLabel(entry['actionType'] as String)),
                      subtitle: Text(
                        [
                          if ((entry['reason'] as String?)?.isNotEmpty == true)
                            entry['reason'] as String,
                          if (_formatAuditTime(entry['createdAt']) != null)
                            _formatAuditTime(entry['createdAt'])!,
                        ].join('\n'),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: actionArea == null
          ? null
          : Material(
              elevation: 8,
              child: SafeArea(top: false, child: actionArea),
            ),
    );
  }
}

String _nextStep(String status, List<String> actions) => switch (status) {
  'draft' => 'Hoàn thiện lý do và gửi phiếu đến Trưởng bộ phận.',
  'pending_department_head' =>
    actions.contains('asset.recall.approve_department')
        ? 'Bạn cần duyệt hoặc trả phiếu về cho nhân viên chỉnh sửa.'
        : 'Phiếu đang chờ Trưởng bộ phận xem xét.',
  'pending_it_head' =>
    actions.contains('asset.recall.approve_it')
        ? 'Bạn cần chọn tài sản thay thế và đưa ra quyết định.'
        : 'Phiếu đang chờ Trưởng IT chọn tài sản thay thế.',
  'revision_required' => 'Nhân viên cần cập nhật nội dung và gửi lại từ đầu.',
  'pending_handover_confirmations' =>
    'Hoàn tất xác nhận hai phía để ghi nhận việc đổi tài sản.',
  'completed' =>
    'Tài sản cũ đã về kho IT và tài sản thay thế đã được bàn giao.',
  _ => 'Theo dõi trạng thái và hành động tiếp theo của phiếu.',
};

String? _rejectionReason(Map<String, dynamic> request) {
  if (request['status'] != 'revision_required') return null;
  const decisions = [
    ('employeeHandoverDecision', 'employeeHandoverNote'),
    ('itHandoverDecision', 'itHandoverNote'),
    ('itHeadDecision', 'itHeadNote'),
    ('departmentHeadDecision', 'departmentHeadNote'),
  ];

  for (final decision in decisions) {
    final note = request[decision.$2] as String?;
    if (request[decision.$1] == 'rejected' && note?.isNotEmpty == true) {
      return note;
    }
  }

  return null;
}

String _auditLabel(String action) => switch (action) {
  'asset.recall.draft_created' => 'Nhân viên đã tạo bản nháp',
  'asset.recall.draft_updated' => 'Nhân viên đã cập nhật phiếu',
  'asset.recall.submitted' => 'Nhân viên đã gửi phiếu',
  'asset.recall.department_decision' => 'Trưởng bộ phận đã xử lý phiếu',
  'asset.recall.it_decision' => 'Trưởng IT đã xử lý phiếu',
  'asset.recall.employee_handover_confirmed' =>
    'Nhân viên đã xác nhận bàn giao',
  'asset.recall.it_handover_confirmed' => 'Trưởng IT đã xác nhận bàn giao',
  'asset.recall.employee_handover_rejected' => 'Nhân viên đã từ chối bàn giao',
  'asset.recall.it_handover_rejected' => 'Trưởng IT đã từ chối bàn giao',
  'asset.recall.exchange_completed' => 'Đã hoàn tất đổi tài sản',
  _ => 'Phiếu đã được cập nhật',
};

String? _formatAuditTime(Object? value) {
  final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
  if (date == null) return null;
  String twoDigits(int number) => number.toString().padLeft(2, '0');

  return '${twoDigits(date.hour)}:${twoDigits(date.minute)} · '
      '${twoDigits(date.day)}/${twoDigits(date.month)}/${date.year}';
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({
    required this.status,
    required this.nextStep,
    required this.rejectionReason,
  });

  final String status;
  final String nextStep;
  final String? rejectionReason;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final needsRevision = status == 'revision_required';
    final complete = status == 'completed';
    final background = needsRevision
        ? colors.errorContainer
        : complete
        ? colors.primaryContainer
        : colors.secondaryContainer;
    final foreground = needsRevision
        ? colors.onErrorContainer
        : complete
        ? colors.onPrimaryContainer
        : colors.onSecondaryContainer;

    return Semantics(
      label: '${assetRecallStatusLabel(status)}. $nextStep',
      child: Card(
        elevation: 0,
        color: background,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                needsRevision
                    ? Icons.error_outline
                    : complete
                    ? Icons.check_circle_outline
                    : Icons.hourglass_top,
                color: foreground,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      assetRecallStatusLabel(status),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: foreground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(nextStep, style: TextStyle(color: foreground)),
                    if (rejectionReason != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        'Lý do trả lại: $rejectionReason',
                        style: TextStyle(
                          color: foreground,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
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
}

class _ApprovalSummary extends StatelessWidget {
  const _ApprovalSummary({required this.request});

  final Map<String, dynamic> request;

  @override
  Widget build(BuildContext context) {
    final employeeConfirmed =
        request['employeeHandoverDecision'] == 'confirmed';
    final itConfirmed = request['itHandoverDecision'] == 'confirmed';
    final confirmedCount = [
      employeeConfirmed,
      itConfirmed,
    ].where((v) => v).length;

    return _Section(
      title: 'Tiến trình phê duyệt',
      children: [
        _DecisionRow(
          label: 'Trưởng bộ phận',
          decision: request['departmentHeadDecision'] as String? ?? 'pending',
        ),
        _DecisionRow(
          label: 'Trưởng IT',
          decision: request['itHeadDecision'] as String? ?? 'pending',
        ),
        ListTile(
          dense: true,
          leading: const Icon(Icons.handshake_outlined),
          title: const Text('Xác nhận bàn giao'),
          trailing: Text('$confirmedCount/2'),
        ),
      ],
    );
  }
}

class _DecisionRow extends StatelessWidget {
  const _DecisionRow({required this.label, required this.decision});

  final String label;
  final String decision;

  @override
  Widget build(BuildContext context) {
    final (labelText, icon, color) = switch (decision) {
      'confirmed' => ('Đã duyệt', Icons.check_circle_outline, Colors.green),
      'rejected' => (
        'Đã trả lại',
        Icons.cancel_outlined,
        Theme.of(context).colorScheme.error,
      ),
      _ => (
        'Đang chờ',
        Icons.schedule_outlined,
        Theme.of(context).colorScheme.outline,
      ),
    };

    return ListTile(
      dense: true,
      leading: Icon(icon, color: color),
      title: Text(label),
      trailing: Text(labelText, style: TextStyle(color: color)),
    );
  }
}

class _AssetComparison extends StatelessWidget {
  const _AssetComparison({required this.original, required this.replacement});

  final Map<String, dynamic> original;
  final Map<String, dynamic>? replacement;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      _AssetSummaryCard(
        title: 'Tài sản thu hồi',
        asset: original,
        icon: Icons.keyboard_return,
      ),
      if (replacement != null) ...[
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 4),
          child: Icon(Icons.swap_vert),
        ),
        _AssetSummaryCard(
          title: 'Tài sản thay thế',
          asset: replacement!,
          icon: Icons.inventory_2_outlined,
          note: 'Trưởng IT xác nhận giá trị quy đổi tương đương.',
        ),
      ],
    ],
  );
}

class _AssetSummaryCard extends StatelessWidget {
  const _AssetSummaryCard({
    required this.title,
    required this.asset,
    required this.icon,
    this.note,
  });

  final String title;
  final Map<String, dynamic> asset;
  final IconData icon;
  final String? note;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(child: Icon(icon)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 4),
                Text(
                  asset['name'] as String? ?? 'Tài sản',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text('Mã: ${asset['assetCode']}'),
                if ((asset['category'] as String?)?.isNotEmpty == true)
                  Text('Danh mục: ${asset['category']}'),
                if (note != null) ...[
                  const SizedBox(height: 8),
                  Text(note!, style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _ActionPrompt extends StatelessWidget {
  const _ActionPrompt({required this.message, required this.child});

  final String message;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, size: 20),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
      ),
      child,
    ],
  );
}

class _DecisionActions extends StatelessWidget {
  const _DecisionActions({
    required this.approveLabel,
    required this.onApprove,
    required this.onReject,
  });

  final String approveLabel;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: onReject,
            child: const Text('Trả lại'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton(onPressed: onApprove, child: Text(approveLabel)),
        ),
      ],
    ),
  );
}

class _SingleAction extends StatelessWidget {
  const _SingleAction({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: FilledButton(onPressed: onPressed, child: Text(label)),
  );
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(8, 14, 8, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(title, style: Theme.of(context).textTheme.titleMedium),
          ),
          const Divider(),
          ...children,
        ],
      ),
    ),
  );
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) =>
      ListTile(dense: true, title: Text(label), subtitle: Text(value));
}

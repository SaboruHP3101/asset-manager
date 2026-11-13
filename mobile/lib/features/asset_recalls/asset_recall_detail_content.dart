import 'package:flutter/material.dart';

import '../../core/utils/department_labels.dart';
import 'asset_recall_models.dart';

class AssetRecallDetailContent extends StatelessWidget {
  const AssetRecallDetailContent({
    required this.request,
    required this.type,
    required this.allowedActions,
    super.key,
  });

  final Map<String, dynamic> request;
  final String type;
  final List<String> allowedActions;

  @override
  Widget build(BuildContext context) {
    final status = request['status'] as String;
    final asset = Map<String, dynamic>.from(request['asset'] as Map);
    final replacement = request['replacementAsset'] == null
        ? null
        : Map<String, dynamic>.from(request['replacementAsset'] as Map);
    final requester = Map<String, dynamic>.from(request['requester'] as Map);
    final department = Map<String, dynamic>.from(request['department'] as Map);
    final trail = (request['trail'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final statusLabel =
        type == 'disposal' &&
            status == 'in_progress' &&
            !allowedActions.contains('asset.recall.complete_disposal')
        ? 'Đã bàn giao'
        : type == 'upgrade' && status == 'in_progress'
        ? 'Đang nâng cấp'
        : assetRecallStatusLabel(status);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        _StatusBanner(
          status: status,
          statusLabel: statusLabel,
          nextStep: _nextStep(status, type, allowedActions),
          rejectionReason: _rejectionReason(request),
        ),
        const SizedBox(height: 12),
        _ApprovalSummary(request: request),
        const SizedBox(height: 12),
        _AssetComparison(
          original: asset,
          replacement: replacement,
          disposal: type == 'disposal',
        ),
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
            _Row(label: 'Lý do', value: request['reason'] as String? ?? '—'),
            if (request['disposalMethod'] != null)
              _Row(
                label: 'Phương thức xử lý',
                value: request['disposalMethod'] as String,
              ),
            if (request['disposalDate'] != null)
              _Row(
                label: 'Ngày xử lý',
                value: request['disposalDate'].toString(),
              ),
            if (request['processingResult'] != null)
              _Row(
                label: type == 'upgrade' ? 'Kết quả nâng cấp' : 'Kết quả xử lý',
                value: request['processingResult'] as String,
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
    );
  }
}

String _nextStep(String status, String type, List<String> actions) =>
    switch (status) {
      'draft' => 'Hoàn thiện lý do và gửi phiếu đến Trưởng bộ phận.',
      'pending_department_head' =>
        actions.contains('asset.recall.approve_department')
            ? 'Bạn cần duyệt hoặc trả phiếu về cho nhân viên chỉnh sửa.'
            : 'Phiếu đang chờ Trưởng bộ phận xem xét.',
      'pending_it_head' =>
        actions.contains('asset.recall.approve_it')
            ? type == 'disposal' || type == 'upgrade'
                  ? 'Bạn cần duyệt hoặc trả phiếu về chỉnh sửa.'
                  : 'Bạn cần chọn tài sản thay thế và đưa ra quyết định.'
            : 'Phiếu đang chờ Trưởng IT xem xét.',
      'revision_required' =>
        'Nhân viên cần cập nhật nội dung và gửi lại từ đầu.',
      'pending_handover_confirmations' =>
        type == 'disposal' || type == 'upgrade'
            ? 'Hoàn tất xác nhận hai phía để đưa tài sản vào kho IT.'
            : 'Hoàn tất xác nhận hai phía để ghi nhận việc đổi tài sản.',
      'in_progress' =>
        actions.contains('asset.recall.complete_disposal')
            ? 'Tài sản đang ở kho IT và chờ bạn hoàn tất báo phế.'
            : actions.contains('asset.recall.process_upgrade')
            ? 'Tài sản đang ở kho IT và chờ bạn hoàn tất nâng cấp.'
            : 'Bạn đã hoàn tất bàn giao.',
      'ready_for_return' =>
        actions.contains('asset.recall.confirm_upgrade_return')
            ? 'Kiểm tra và xác nhận nhận lại tài sản đã nâng cấp.'
            : 'Tài sản đã nâng cấp đang chờ nhân viên xác nhận nhận lại.',
      'completed' =>
        type == 'disposal'
            ? 'Tài sản đã được ghi nhận báo phế.'
            : type == 'upgrade'
            ? 'Tài sản đã được nâng cấp và bàn giao lại.'
            : 'Tài sản cũ đã về kho IT và tài sản thay thế đã được bàn giao.',
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
  'asset.recall.disposal_received' => 'Tài sản đã được nhận vào kho IT',
  'asset.recall.disposal_completed' => 'Đã hoàn tất báo phế tài sản',
  'asset.recall.upgrade_received' => 'Tài sản đã được nhận vào kho IT',
  'asset.recall.upgrade_completed' => 'IT đã hoàn tất nâng cấp',
  'asset.recall.upgrade_return_confirmed' => 'Nhân viên đã nhận lại tài sản',
  'asset.recall.upgrade_return_rejected' =>
    'Nhân viên yêu cầu xử lý nâng cấp lại',
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
    required this.statusLabel,
    required this.nextStep,
    required this.rejectionReason,
  });

  final String status;
  final String statusLabel;
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
      label: '$statusLabel. $nextStep',
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
                      statusLabel,
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
  const _AssetComparison({
    required this.original,
    required this.replacement,
    required this.disposal,
  });

  final Map<String, dynamic> original;
  final Map<String, dynamic>? replacement;
  final bool disposal;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      _AssetSummaryCard(
        title: disposal ? 'Tài sản báo phế' : 'Tài sản thu hồi',
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

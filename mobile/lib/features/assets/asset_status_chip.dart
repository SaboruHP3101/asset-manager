import 'package:flutter/material.dart';

import '../../core/widgets/status_chip.dart';

String assetStatusLabel(String status) => switch (status.toLowerCase()) {
  'in_use' || 'using' || 'active' => 'Đang sử dụng',
  'repairing' || 'fixing' => 'Đang sửa chữa',
  'upgrading' => 'Đang nâng cấp',
  'available' => 'Sẵn sàng',
  'reserved_for_exchange' => 'Đã giữ chỗ',
  'awaiting_disposal' => 'Chờ xử lý báo phế',
  'disposed' => 'Đã báo phế',
  'awaiting_allocation' => 'Chờ cấp phát',
  'awaiting_reallocation' => 'Chờ phân bổ lại',
  'awaiting_allocation_confirmation' => 'Chờ xác nhận',
  'damaged' || 'broken' => 'Hỏng',
  'inactive' => 'Ngừng hoạt động',
  _ => status.replaceAll('_', ' '),
};

String assetStatusFilterKey(String status) => switch (status.toLowerCase()) {
  'in_use' || 'using' || 'active' => 'in_use',
  'repairing' || 'fixing' => 'repairing',
  'upgrading' => 'upgrading',
  _ => status.toLowerCase(),
};

class AssetStatusChip extends StatelessWidget {
  const AssetStatusChip({
    required this.status,
    this.compact = false,
    super.key,
  });

  final String status;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final presentation = _presentation(context, status);

    return StatusChip(
      icon: presentation.icon,
      label: assetStatusLabel(status),
      foregroundColor: presentation.color,
      backgroundColor: presentation.color.withValues(alpha: 0.12),
      compact: compact,
    );
  }
}

_StatusPresentation _presentation(BuildContext context, String status) {
  final colors = Theme.of(context).colorScheme;

  return switch (status.toLowerCase()) {
    'in_use' || 'using' || 'active' => const _StatusPresentation(
      Color(0xFF1B7F4B),
      Icons.check_circle_outline,
    ),
    'available' => const _StatusPresentation(
      Color(0xFF1976D2),
      Icons.inventory_2_outlined,
    ),
    'reserved_for_exchange' => const _StatusPresentation(
      Color(0xFF6A1B9A),
      Icons.bookmark_added_outlined,
    ),
    'awaiting_disposal' => const _StatusPresentation(
      Color(0xFFB26A00),
      Icons.schedule_outlined,
    ),
    'disposed' => _StatusPresentation(colors.error, Icons.delete_outline),
    'repairing' || 'fixing' => const _StatusPresentation(
      Color(0xFFB26A00),
      Icons.build_outlined,
    ),
    'upgrading' => const _StatusPresentation(Color(0xFF6A1B9A), Icons.upgrade),
    'awaiting_allocation' ||
    'awaiting_reallocation' ||
    'awaiting_allocation_confirmation' => const _StatusPresentation(
      Color(0xFF536DFE),
      Icons.schedule_outlined,
    ),
    'damaged' ||
    'broken' => _StatusPresentation(colors.error, Icons.error_outline),
    _ => _StatusPresentation(colors.outline, Icons.info_outline),
  };
}

class _StatusPresentation {
  const _StatusPresentation(this.color, this.icon);

  final Color color;
  final IconData icon;
}

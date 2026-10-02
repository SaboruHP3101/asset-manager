import 'package:flutter/material.dart';

String assetStatusLabel(String status) => switch (status.toLowerCase()) {
  'in_use' || 'using' || 'active' => 'Đang sử dụng',
  'repairing' || 'fixing' => 'Đang sửa chữa',
  'available' => 'Sẵn sàng',
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

    return Semantics(
      label: 'Trạng thái: ${assetStatusLabel(status)}',
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 10,
          vertical: compact ? 5 : 6,
        ),
        decoration: BoxDecoration(
          color: presentation.color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              presentation.icon,
              size: compact ? 14 : 16,
              color: presentation.color,
            ),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                assetStatusLabel(status),
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: presentation.color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
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
    'repairing' || 'fixing' => const _StatusPresentation(
      Color(0xFFB26A00),
      Icons.build_outlined,
    ),
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

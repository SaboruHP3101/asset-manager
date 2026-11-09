import 'package:flutter/material.dart';

import 'purchase_request_models.dart';

/// Displays the request's available actions and procurement quote progress.
class PurchaseRequestActionBar extends StatelessWidget {
  const PurchaseRequestActionBar({
    required this.detail,
    required this.disabled,
    required this.addingQuote,
    required this.onAction,
    required this.onChooseQuote,
    required this.onCreateOrder,
    super.key,
  });

  final PurchaseRequestDetail detail;
  final bool disabled;
  final bool addingQuote;
  final ValueChanged<String> onAction;
  final VoidCallback onChooseQuote;
  final VoidCallback onCreateOrder;

  @override
  Widget build(BuildContext context) {
    final quoteProgress = _QuoteProgress.fromItems(detail.items);
    Widget? primary;
    if (detail.allows('purchase.request.update')) {
      primary = OutlinedButton.icon(
        onPressed: disabled ? null : () => onAction('edit'),
        icon: const Icon(Icons.edit),
        label: const Text('Chỉnh sửa'),
      );
    }
    if (detail.allows('purchase.request.submit')) {
      primary = FilledButton(
        onPressed: disabled ? null : () => onAction('submit'),
        child: const Text('Gửi trình ký'),
      );
    }
    if (detail.allows('purchase.request.approve_department')) {
      primary = FilledButton(
        onPressed: disabled ? null : () => onAction('department'),
        child: const Text('Xử lý cấp phòng'),
      );
    }
    if (detail.allows('purchase.request.enrich_procurement')) {
      primary = FilledButton(
        onPressed: disabled || !quoteProgress.isComplete
            ? null
            : () => onAction('submit_procurement'),
        child: const Text('Trình Trưởng Thu mua'),
      );
    }
    if (detail.allows('purchase.request.approve_procurement')) {
      primary = FilledButton(
        onPressed: disabled ? null : () => onAction('procurement'),
        child: const Text('Duyệt thương mại'),
      );
    }
    if (detail.allows('purchase.request.approve_it')) {
      primary = FilledButton(
        onPressed: disabled ? null : () => onAction('it'),
        child: const Text('Duyệt chuyên môn IT'),
      );
    }
    if (detail.allows('purchase.order.create')) {
      primary = FilledButton.icon(
        onPressed: disabled ? null : onCreateOrder,
        icon: const Icon(Icons.add_shopping_cart),
        label: const Text('Tạo đơn đặt mua'),
      );
    }
    final canEdit =
        detail.allows('purchase.request.update') &&
        detail.allows('purchase.request.submit');
    final canAddQuote = detail.allows('purchase.request.enrich_procurement');
    if (primary == null && !canAddQuote) return const SizedBox.shrink();

    return Semantics(
      label: 'Hành động có thể thực hiện',
      child: Material(
        elevation: 8,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (canAddQuote) ...[
                  _QuoteProgressSummary(progress: quoteProgress),
                  const SizedBox(height: 10),
                ],
                ?primary,
                if (canEdit || canAddQuote) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (canEdit)
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: disabled ? null : () => onAction('edit'),
                            icon: const Icon(Icons.edit_outlined),
                            label: const Text('Chỉnh sửa'),
                          ),
                        ),
                      if (canEdit && canAddQuote) const SizedBox(width: 8),
                      if (canAddQuote)
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: disabled ? null : onChooseQuote,
                            icon: addingQuote
                                ? const SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.request_quote_outlined),
                            label: Text(
                              addingQuote
                                  ? 'Đang lưu báo giá...'
                                  : 'Thêm báo giá',
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuoteProgress {
  const _QuoteProgress({
    required this.total,
    required this.completed,
    required this.missingNames,
  });

  factory _QuoteProgress.fromItems(List<Map<String, dynamic>> items) {
    final missing = items
        .where((item) => !purchaseItemHasSelectedQuote(item))
        .map((item) => item['itemName']?.toString() ?? 'Hạng mục chưa đặt tên')
        .toList();

    return _QuoteProgress(
      total: items.length,
      completed: items.length - missing.length,
      missingNames: missing,
    );
  }

  final int total;
  final int completed;
  final List<String> missingNames;

  bool get isComplete => total > 0 && completed == total;
}

class _QuoteProgressSummary extends StatelessWidget {
  const _QuoteProgressSummary({required this.progress});

  final _QuoteProgress progress;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final missingSummary = progress.missingNames.length <= 2
        ? progress.missingNames.join(', ')
        : '${progress.missingNames.take(2).join(', ')} và '
              '${progress.missingNames.length - 2} hạng mục khác';

    return Semantics(
      label: progress.isComplete
          ? 'Đã hoàn tất báo giá cho tất cả hạng mục'
          : 'Còn hạng mục chưa chọn báo giá',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: progress.isComplete
              ? colorScheme.primaryContainer
              : colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    progress.isComplete
                        ? Icons.check_circle_outline
                        : Icons.pending_actions_outlined,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Đã hoàn tất báo giá '
                      '${progress.completed}/${progress.total} hạng mục',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              if (!progress.isComplete && missingSummary.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Còn thiếu: $missingSummary',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

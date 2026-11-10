import 'package:flutter/material.dart';

import '../../core/widgets/status_chip.dart';
import 'purchase_request_models.dart';

/// Lets procurement choose a request item, with incomplete quotes shown first.
Future<Map<String, dynamic>?> pickPurchaseQuoteItem(
  BuildContext context,
  List<Map<String, dynamic>> requestItems,
) {
  final items = [...requestItems]
    ..sort(
      (left, right) =>
          _quoteState(left).sortOrder.compareTo(_quoteState(right).sortOrder),
    );
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.only(bottom: 12),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              'Chọn hạng mục thêm báo giá',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          for (final item in items)
            ListTile(
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item['itemName'] as String),
                  const SizedBox(height: 2),
                  Text(
                    '${item['categoryName']} • Số lượng ${item['quantity']}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  _QuoteStateChip(state: _quoteState(item)),
                ],
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.pop(context, item),
            ),
        ],
      ),
    ),
  );
}

enum _QuoteState {
  missing('Chưa có báo giá', 0),
  unselected('Chưa chọn báo giá', 1),
  selected('Đã chọn báo giá', 2);

  const _QuoteState(this.label, this.sortOrder);

  final String label;
  final int sortOrder;
}

_QuoteState _quoteState(Map<String, dynamic> item) {
  final quotes = item['quotes'];

  if (quotes is! List || quotes.isEmpty) return _QuoteState.missing;
  if (purchaseItemHasSelectedQuote(item)) return _QuoteState.selected;

  return _QuoteState.unselected;
}

class _QuoteStateChip extends StatelessWidget {
  const _QuoteStateChip({required this.state});

  final _QuoteState state;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final selected = state == _QuoteState.selected;

    return StatusChip(
      icon: switch (state) {
        _QuoteState.missing => Icons.request_quote_outlined,
        _QuoteState.unselected => Icons.pending_actions_outlined,
        _QuoteState.selected => Icons.check_circle_outline,
      },
      label: state.label,
      compact: true,
      backgroundColor: selected ? colorScheme.primaryContainer : null,
      foregroundColor: selected ? colorScheme.onPrimaryContainer : null,
    );
  }
}

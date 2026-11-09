import 'package:flutter/material.dart';

import 'purchase_request_models.dart';

/// Displays the request summary, items, and processing history.
class PurchaseRequestDetailContent extends StatelessWidget {
  const PurchaseRequestDetailContent({required this.detail, super.key});

  final PurchaseRequestDetail detail;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Header(detail: detail),
        if (detail.returnReason != null) ...[
          const SizedBox(height: 12),
          Card(
            color: Theme.of(context).colorScheme.errorContainer,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text('Lý do trả về: ${detail.returnReason}'),
            ),
          ),
        ],
        const SizedBox(height: 16),
        const Text(
          'Hạng mục',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        for (final item in detail.items) _ItemCard(item: item),
        const SizedBox(height: 20),
        const Text(
          'Lịch sử xử lý',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        if (detail.timeline.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('Chưa có lịch sử xử lý.'),
          )
        else
          for (final event in detail.timeline)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.history),
              title: Text(
                purchaseHistoryActionLabel(
                  event['actionType']?.toString() ?? '',
                ),
              ),
              subtitle: Text(
                '${purchaseHistoryStatusTransitionLabel(event['previousStatus']?.toString() ?? '', event['newStatus']?.toString() ?? '')}'
                '${event['reason'] == null ? '' : '\n${event['reason']}'}',
              ),
            ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.detail});

  final PurchaseRequestDetail detail;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              purchaseStatusLabel(detail.status),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            Text('Revision ${detail.revision}'),
            const Divider(),
            Text('Ngày cần: ${detail.neededByDate}'),
            Text('Mục đích: ${detail.purpose}'),
            if (detail.note?.isNotEmpty ?? false)
              Text('Ghi chú: ${detail.note}'),
          ],
        ),
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final quotes = List<Map<String, dynamic>>.from(
      (item['quotes'] as List).map((quote) => Map<String, dynamic>.from(quote)),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item['itemName'] as String,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            Text('${item['categoryName']} • SL: ${item['quantity']}'),
            Text(item['specifications'] as String),
            if (quotes.isNotEmpty) ...[
              const Divider(),
              for (final quote in quotes)
                Text(
                  '${quote['supplierName']}: ${quote['unitPriceExclVat']} VND'
                  '${quote['isSelected'] == true ? ' • Đã chọn' : ''}',
                ),
            ],
          ],
        ),
      ),
    );
  }
}

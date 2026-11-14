part of 'purchase_order_form.dart';

class _OrderQuantityCard extends StatelessWidget {
  const _OrderQuantityCard({
    required this.item,
    required this.controller,
    required this.quantity,
    required this.onChanged,
    required this.onSetQuantity,
  });

  final EligiblePurchaseOrderItem item;
  final TextEditingController controller;
  final int quantity;
  final VoidCallback onChanged;
  final ValueChanged<int> onSetQuantity;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: quantity > 0,
                  onChanged: (selected) =>
                      onSetQuantity(selected == true ? 1 : 0),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.itemName,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Còn có thể đặt: ${item.remainingQuantity}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconButton.filledTonal(
                  tooltip: 'Giảm số lượng ${item.itemName}',
                  onPressed: quantity <= 0
                      ? null
                      : () => onSetQuantity(
                          (int.tryParse(controller.text) ?? 0) - 1,
                        ),
                  icon: const Icon(Icons.remove),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: controller,
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Số lượng'),
                    onChanged: (_) => onChanged(),
                    validator: (value) {
                      final quantity = int.tryParse(value ?? '');
                      if (quantity == null || quantity < 0) {
                        return 'Không hợp lệ';
                      }
                      if (quantity > item.remainingQuantity) {
                        return 'Tối đa ${item.remainingQuantity}';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filledTonal(
                  tooltip: 'Tăng số lượng ${item.itemName}',
                  onPressed: quantity >= item.remainingQuantity
                      ? null
                      : () => onSetQuantity(
                          (int.tryParse(controller.text) ?? 0) + 1,
                        ),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 8),
      Text(title, style: Theme.of(context).textTheme.titleMedium),
    ],
  );
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.requestCode});

  final String requestCode;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: ListTile(
      leading: const Icon(Icons.assignment_turned_in_outlined),
      title: const Text('Đề nghị'),
      subtitle: Text(requestCode),
      trailing: const Icon(Icons.lock_outline, size: 20),
    ),
  );
}

class _ItemsEmptyState extends StatelessWidget {
  const _ItemsEmptyState({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.onSurfaceVariant),
        const SizedBox(height: 10),
        Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    ),
  );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.itemCount, required this.quantity});

  final int itemCount;
  final int quantity;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Icon(Icons.summarize_outlined),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '$itemCount hạng mục · Tổng số lượng: $quantity',
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
        ],
      ),
    ),
  );
}

class _PurchaseOrderActionBar extends StatelessWidget {
  const _PurchaseOrderActionBar({
    required this.saving,
    required this.enabled,
    required this.hint,
    required this.onSave,
    required this.onSubmit,
  });

  final bool saving;
  final bool enabled;
  final String? hint;
  final VoidCallback onSave;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) => Material(
    elevation: 12,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (hint != null) ...[
              Text(
                hint!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
            ],
            Wrap(
              spacing: 8,
              alignment: WrapAlignment.center,
              children: [
                FilledButton.icon(
                  onPressed: enabled ? onSave : null,
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Lưu nháp'),
                ),
                if (onSubmit != null)
                  FilledButton.icon(
                    onPressed: enabled ? onSubmit : null,
                    icon: const Icon(Icons.send_outlined),
                    label: const Text('Gửi duyệt'),
                  ),
              ],
            ),
            if (saving) const LinearProgressIndicator(),
          ],
        ),
      ),
    ),
  );
}

class _NewOrderReviewSheet extends StatelessWidget {
  const _NewOrderReviewSheet({
    required this.requestCode,
    required this.supplierName,
    required this.orderDate,
    required this.deliveryDate,
    required this.items,
  });

  final String requestCode;
  final String supplierName;
  final DateTime orderDate;
  final DateTime deliveryDate;
  final Map<EligiblePurchaseOrderItem, int> items;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Kiểm tra trước khi gửi duyệt',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text('Sau khi gửi, đơn sẽ bị khóa cho đến khi được trả về.'),
          const SizedBox(height: 16),
          Text('Đề nghị: $requestCode'),
          Text('Nhà cung cấp: $supplierName'),
          Text('Ngày đặt: ${formatDisplayDate(orderDate)}'),
          Text('Giao dự kiến: ${formatDisplayDate(deliveryDate)}'),
          const Divider(),
          for (final entry in items.entries)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(entry.key.itemName),
              trailing: Text('×${entry.value}'),
            ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Xác nhận gửi duyệt'),
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Quay lại kiểm tra'),
            ),
          ),
        ],
      ),
    ),
  );
}

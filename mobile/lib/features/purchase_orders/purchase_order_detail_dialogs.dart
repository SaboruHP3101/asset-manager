part of 'purchase_order_detail_screen.dart';

Future<_OrderDecision?> _showDecisionSheet(BuildContext context) async {
  var returning = false;
  var reason = '';

  return showModalBottomSheet<_OrderDecision>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => StatefulBuilder(
      builder: (context, setSheetState) => SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            20,
            0,
            20,
            20 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                returning ? 'Trả về chỉnh sửa' : 'Xử lý đơn đặt mua',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 6),
              Text(
                returning
                    ? 'Nhập lý do để người lập đơn biết nội dung cần chỉnh sửa.'
                    : 'Duyệt để phát hành hoặc trả về để chỉnh sửa.',
              ),
              const SizedBox(height: 20),
              if (returning) ...[
                TextField(
                  autofocus: true,
                  maxLines: 3,
                  onChanged: (value) {
                    reason = value;
                    setSheetState(() {});
                  },
                  decoration: textareaDecoration(
                    context,
                    const InputDecoration(labelText: 'Lý do bắt buộc'),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: reason.trim().isEmpty
                      ? null
                      : () => Navigator.pop(
                          context,
                          _OrderDecision(
                            approved: false,
                            reason: reason.trim(),
                          ),
                        ),
                  child: const Text('Xác nhận trả về'),
                ),
                TextButton(
                  onPressed: () => setSheetState(() => returning = false),
                  child: const Text('Quay lại'),
                ),
              ] else ...[
                FilledButton.icon(
                  onPressed: () => Navigator.pop(
                    context,
                    const _OrderDecision(approved: true),
                  ),
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Duyệt và phát hành'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => setSheetState(() => returning = true),
                  icon: const Icon(Icons.undo_outlined),
                  label: const Text('Trả về chỉnh sửa'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Đóng'),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

Future<String?> _showReasonDialog(BuildContext context, String title) async {
  var reason = '';

  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        autofocus: true,
        maxLines: 3,
        onChanged: (value) => reason = value,
        decoration: textareaDecoration(
          context,
          const InputDecoration(labelText: 'Lý do bắt buộc'),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Đóng'),
        ),
        FilledButton(
          onPressed: () {
            final value = reason.trim();
            if (value.isNotEmpty) Navigator.pop(context, value);
          },
          child: const Text('Xác nhận'),
        ),
      ],
    ),
  );
}

class _SubmitReviewSheet extends StatelessWidget {
  const _SubmitReviewSheet({required this.detail});

  final PurchaseOrderDetail detail;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Kiểm tra trước khi trình duyệt',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 6),
          const Text('Sau khi trình, đơn sẽ bị khóa cho đến khi được trả về.'),
          const SizedBox(height: 16),
          Text('Đơn mua: ${detail.purchaseOrderCode}'),
          Text('Đề nghị: ${detail.requestCode}'),
          Text('Nhà cung cấp: ${detail.supplierName}'),
          Text('Ngày đặt: ${detail.orderDate}'),
          Text('Giao dự kiến: ${detail.expectedDeliveryDate}'),
          const Divider(height: 28),
          Text('Hạng mục', style: Theme.of(context).textTheme.titleMedium),
          for (final item in detail.items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item['itemNameSnapshot'] as String),
              trailing: Text('×${item['quantity']}'),
            ),
          const Divider(height: 20),
          Text(
            'Tổng cộng: ${_money(detail.totals['totalInclVat'])} VND',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: const Icon(Icons.send_outlined),
              label: const Text('Xác nhận trình duyệt'),
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

enum _OrderOverflowAction { cancel, closeShort }

class _OrderDecision {
  const _OrderDecision({required this.approved, this.reason});
  final bool approved;
  final String? reason;
}

/// Format chuỗi số VND

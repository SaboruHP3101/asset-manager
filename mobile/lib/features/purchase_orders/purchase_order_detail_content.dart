part of 'purchase_order_detail_screen.dart';

class _OrderHeader extends StatelessWidget {
  const _OrderHeader({required this.detail});
  final PurchaseOrderDetail detail;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            purchaseOrderStatusLabel(detail.status),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          Text('Đề nghị: ${detail.requestCode}'),
          Text('Nhà cung cấp: ${detail.supplierName}'),
          Text('Ngày đặt: ${detail.orderDate}'),
          Text('Giao dự kiến: ${detail.expectedDeliveryDate}'),
        ],
      ),
    ),
  );
}

class _OrderItem extends StatelessWidget {
  const _OrderItem({required this.item});
  final Map<String, dynamic> item;

  /// Hiển thị danh sách đơn mua
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      title: Text(item['itemNameSnapshot'] as String),
      subtitle: Text(
        'SL: ${item['quantity']} • Đơn giá: ${_money(item['unitPriceExclVat'])} VND\n'
        'VAT: ${item['vatRate']}% • Thành tiền: ${_money(item['totalInclVat'])} VND',
      ),
    ),
  );
}

class _Totals extends StatelessWidget {
  const _Totals({required this.totals});
  final Map<String, dynamic> totals;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Trước VAT: ${_money(totals['subtotalExclVat'])} VND'),
          Text('Tiền VAT: ${_money(totals['vatAmount'])} VND'),
          Text(
            'Tổng cộng: ${_money(totals['totalInclVat'])} VND',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
      ),
    ),
  );
}

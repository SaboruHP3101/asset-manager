import 'package:flutter/material.dart';

import 'purchase_order_form.dart';
import 'purchase_order_models.dart';
import 'purchase_orders_repository.dart';

class PurchaseOrderDetailScreen extends StatefulWidget {
  const PurchaseOrderDetailScreen({
    required this.orderId,
    super.key,
    this.repository,
  });

  final String orderId;
  final PurchaseOrdersRepository? repository;

  /// Tạo state tải detail và xử lý action của đơn mua
  @override
  State<PurchaseOrderDetailScreen> createState() =>
      _PurchaseOrderDetailScreenState();
}

class _PurchaseOrderDetailScreenState extends State<PurchaseOrderDetailScreen> {
  late final PurchaseOrdersRepository _repository;
  PurchaseOrderDetail? _detail;
  String? _error;
  bool _acting = false;

  /// Khởi tạo repository rồi tải đơn mua ngay khi mở màn hình
  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseOrdersRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _detail = null;
      _error = null;
    });
    try {
      final detail = await _repository.findOne(widget.orderId);
      if (!mounted) return;
      setState(() => _detail = detail);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = purchaseOrderApiError(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(
        title: Text(detail?.purchaseOrderCode ?? 'Chi tiết đơn mua'),
      ),
      body: _error != null
          ? _DetailMessage(message: _error!, onRetry: _load)
          : detail == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _OrderHeader(detail: detail),
                  if (detail.cancellationReason != null)
                    Card(
                      color: Theme.of(context).colorScheme.errorContainer,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text('Lý do hủy: ${detail.cancellationReason}'),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Text(
                    'Hạng mục',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  for (final item in detail.items) _OrderItem(item: item),
                  const SizedBox(height: 8),
                  _Totals(totals: detail.totals),
                  const SizedBox(height: 16),
                  _actions(detail),
                  const SizedBox(height: 20),
                  Text(
                    'Lịch sử',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (detail.timeline.isEmpty)
                    const Text('Chưa có lịch sử xử lý.')
                  else
                    for (final event in detail.timeline)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.history),
                        title: Text(
                          purchaseOrderHistoryLabel(
                            event['actionType']?.toString() ?? '',
                          ),
                        ),
                        subtitle: Text(
                          '${purchaseOrderStatusLabel(event['previousStatus']?.toString() ?? '')} → '
                          '${purchaseOrderStatusLabel(event['newStatus']?.toString() ?? '')}'
                          '${event['reason'] == null ? '' : '\n${event['reason']}'}',
                        ),
                      ),
                ],
              ),
            ),
    );
  }

  /// Dựng nhóm nút edit/submit/approve/cancel từ allowedActions của API
  Widget _actions(PurchaseOrderDetail detail) {
    final buttons = <Widget>[];
    if (detail.allows('purchase.order.create')) {
      buttons.add(
        OutlinedButton.icon(
          onPressed: _acting ? null : _edit,
          icon: const Icon(Icons.edit_outlined),
          label: const Text('Chỉnh sửa'),
        ),
      );
    }
    if (detail.allows('purchase.order.submit')) {
      buttons.add(
        FilledButton(
          onPressed: _acting
              ? null
              : () => _run(() => _repository.submit(detail.id)),
          child: const Text('Trình duyệt'),
        ),
      );
    }
    if (detail.allows('purchase.order.approve')) {
      buttons.add(
        FilledButton(
          onPressed: _acting ? null : _decide,
          child: const Text('Xử lý đơn mua'),
        ),
      );
    }
    if (detail.allows('purchase.order.cancel')) {
      buttons.add(
        OutlinedButton(
          onPressed: _acting ? null : _cancel,
          child: const Text('Hủy đơn mua'),
        ),
      );
    }
    if (buttons.isEmpty) return const SizedBox.shrink();
    return Semantics(
      label: 'Hành động đơn đặt mua',
      child: Wrap(spacing: 8, runSpacing: 8, children: buttons),
    );
  }

  Future<void> _edit() async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            PurchaseOrderFormScreen(repository: _repository, initial: _detail),
      ),
    );
    if (changed == true) await _load();
  }

  /// Hỏi duyệt/từ chối, bắt buộc lý do khi từ chối rồi gọi API
  Future<void> _decide() async {
    final decision = await _showDecisionDialog();
    if (decision == null) return;
    await _run(
      () => _repository.decide(
        _detail!.id,
        approved: decision.approved,
        reason: decision.reason,
      ),
    );
  }

  /// Yêu cầu lý do bắt buộc trước khi gọi API hủy đơn mua
  Future<void> _cancel() async {
    final reason = await _showReasonDialog('Hủy đơn đặt mua');
    if (reason == null) return;
    await _run(() => _repository.cancel(_detail!.id, reason));
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _acting = true);
    try {
      await action();
      await _load();
      if (mounted) setState(() => _acting = false);
    } catch (error) {
      if (!mounted) return;
      setState(() => _acting = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseOrderApiError(error))));
    }
  }

  /// Hiển thị dialog hai lựa chọn
  Future<_OrderDecision?> _showDecisionDialog() async {
    final approved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xử lý đơn đặt mua'),
        content: const Text('Duyệt để phát hành hoặc trả về để chỉnh sửa.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
          OutlinedButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Trả về'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Duyệt'),
          ),
        ],
      ),
    );
    if (approved == null) return null;
    if (approved) return const _OrderDecision(approved: true);
    final reason = await _showReasonDialog('Lý do trả về');
    return reason == null
        ? null
        : _OrderDecision(approved: false, reason: reason);
  }

  Future<String?> _showReasonDialog(String title) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Lý do bắt buộc'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
          FilledButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.isNotEmpty) Navigator.pop(context, value);
            },
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }
}

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

class _DetailMessage extends StatelessWidget {
  const _DetailMessage({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(message, textAlign: TextAlign.center),
        FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
      ],
    ),
  );
}

class _OrderDecision {
  const _OrderDecision({required this.approved, this.reason});
  final bool approved;
  final String? reason;
}

/// Format chuỗi số VND
String _money(Object? value) {
  final digits = value.toString();
  return digits.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');
}

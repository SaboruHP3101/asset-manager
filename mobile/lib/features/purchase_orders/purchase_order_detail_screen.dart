import 'package:flutter/material.dart';

import 'purchase_order_form.dart';
import 'purchase_order_models.dart';
import 'purchase_orders_repository.dart';
import '../purchase_receipts/purchase_receipt_form.dart';
import '../purchase_receipts/purchase_receipt_models.dart';
import '../purchase_receipts/purchase_receipts_repository.dart';

class PurchaseOrderDetailScreen extends StatefulWidget {
  const PurchaseOrderDetailScreen({
    required this.orderId,
    super.key,
    this.repository,
    this.receiptsRepository,
  });

  final String orderId;
  final PurchaseOrdersRepository? repository;
  final PurchaseReceiptsRepository? receiptsRepository;

  /// Tạo state tải detail và xử lý action của đơn mua
  @override
  State<PurchaseOrderDetailScreen> createState() =>
      _PurchaseOrderDetailScreenState();
}

class _PurchaseOrderDetailScreenState extends State<PurchaseOrderDetailScreen> {
  late final PurchaseOrdersRepository _repository;
  late final PurchaseReceiptsRepository _receiptsRepository;
  PurchaseOrderDetail? _detail;
  List<PurchaseReceiptProgress> _progress = const [];
  String? _error;
  bool _acting = false;

  /// Khởi tạo repository rồi tải đơn mua ngay khi mở màn hình
  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseOrdersRepository();
    _receiptsRepository =
        widget.receiptsRepository ?? PurchaseReceiptsRepository();
    _load();
  }

  Future<({PurchaseOrderDetail detail, List<PurchaseReceiptProgress> progress})>
  _fetchLatest() async {
    final detail = await _repository.findOne(widget.orderId);
    final progress =
        [
          'issued',
          'partially_received',
          'fully_received',
          'closed_short',
        ].contains(detail.status)
        ? await _receiptsRepository.findOrderProgress(widget.orderId)
        : <PurchaseReceiptProgress>[];

    return (detail: detail, progress: progress);
  }

  Future<void> _load() async {
    setState(() {
      _detail = null;
      _progress = const [];
      _error = null;
    });
    try {
      final latest = await _fetchLatest();
      if (!mounted) return;
      setState(() {
        _detail = latest.detail;
        _progress = latest.progress;
      });
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
      body: Stack(
        children: [
          Positioned.fill(
            child: _error != null
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
                              child: Text(
                                '${detail.status == 'closed_short' ? 'Lý do đóng thiếu' : 'Lý do hủy'}: '
                                '${detail.cancellationReason}',
                              ),
                            ),
                          ),
                        const SizedBox(height: 16),
                        Text(
                          'Hạng mục',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        for (final item in detail.items) _OrderItem(item: item),
                        if (_progress.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(
                            'Tiến độ giao và kiểm tra',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          for (final line in _progress)
                            Card(
                              child: ListTile(
                                title: Text(line.itemName),
                                subtitle: Text(
                                  'Đặt ${line.ordered} • Đã giao ${line.delivered} • '
                                  'Đạt ${line.accepted} • Không đạt ${line.rejected}\n'
                                  'Chờ kiểm tra ${line.pending} • Còn có thể giao ${line.remaining}',
                                ),
                              ),
                            ),
                        ],
                        const SizedBox(height: 8),
                        _Totals(totals: detail.totals),
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
                                '${purchaseOrderHistoryStatusTransitionLabel(event['previousStatus']?.toString() ?? '', event['newStatus']?.toString() ?? '')}'
                                '${event['reason'] == null ? '' : '\n${event['reason']}'}',
                              ),
                            ),
                      ],
                    ),
                  ),
          ),
          if (_acting)
            Positioned.fill(
              child: ColoredBox(
                color: Theme.of(context).colorScheme.scrim
                    .withValues(alpha: 0.22),
                child: Center(
                  child: Semantics(
                    label: 'Đang cập nhật đơn đặt mua',
                    liveRegion: true,
                    child: const Card(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: CircularProgressIndicator(
                          key: Key('po-action-loader'),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: detail == null || _error != null
          ? null
          : _OrderActionBar(
              detail: detail,
              disabled: _acting,
              onEdit: _edit,
              onSubmit: () => _run(() => _repository.submit(detail.id)),
              onDecide: _decide,
              onRecordReceipt: _recordReceipt,
              onCancel: _cancel,
              onCloseShort: _closeShort,
            ),
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

  Future<void> _recordReceipt() async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PurchaseReceiptFormScreen(
          orderId: widget.orderId,
          repository: _receiptsRepository,
        ),
      ),
    );
    if (changed == true) await _load();
  }

  Future<void> _closeShort() async {
    final reason = await _showReasonDialog('Xác nhận đóng thiếu');
    if (reason == null) return;
    await _run(() => _receiptsRepository.closeShort(widget.orderId, reason));
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
    if (_acting) return;
    setState(() => _acting = true);

    try {
      await action();
    } catch (error) {
      if (!mounted) return;
      setState(() => _acting = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseOrderApiError(error))));
      return;
    }

    try {
      final latest = await _fetchLatest();
      if (!mounted) return;
      setState(() {
        _detail = latest.detail;
        _progress = latest.progress;
        _error = null;
        _acting = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _detail = null;
        _progress = const [];
        _error =
            'Thao tác đã hoàn tất nhưng không thể tải trạng thái mới. '
            '${purchaseOrderApiError(error)}';
        _acting = false;
      });
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

class _OrderActionBar extends StatelessWidget {
  const _OrderActionBar({
    required this.detail,
    required this.disabled,
    required this.onEdit,
    required this.onSubmit,
    required this.onDecide,
    required this.onRecordReceipt,
    required this.onCancel,
    required this.onCloseShort,
  });

  final PurchaseOrderDetail detail;
  final bool disabled;
  final VoidCallback onEdit;
  final VoidCallback onSubmit;
  final VoidCallback onDecide;
  final VoidCallback onRecordReceipt;
  final VoidCallback onCancel;
  final VoidCallback onCloseShort;

  @override
  Widget build(BuildContext context) {
    Widget? primary;
    if (detail.allows('purchase.order.submit')) {
      primary = FilledButton(
        onPressed: disabled ? null : onSubmit,
        child: const Text('Trình duyệt'),
      );
    }
    if (detail.allows('purchase.order.approve')) {
      primary = FilledButton(
        onPressed: disabled ? null : onDecide,
        child: const Text('Xử lý đơn mua'),
      );
    }
    if (detail.allows('purchase.receipt.record')) {
      primary = FilledButton.icon(
        onPressed: disabled ? null : onRecordReceipt,
        icon: const Icon(Icons.local_shipping_outlined),
        label: const Text('Ghi nhận giao hàng'),
      );
    }

    final canEdit = detail.allows('purchase.order.create');
    final canCancel = detail.allows('purchase.order.cancel');
    final canCloseShort = detail.allows('purchase.receipt.close_short');
    if (primary == null && !canEdit && !canCancel && !canCloseShort) {
      return const SizedBox.shrink();
    }

    return Semantics(
      label: 'Hành động đơn đặt mua',
      child: Material(
        elevation: 8,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Row(
              children: [
                if (canEdit) ...[
                  OutlinedButton.icon(
                    onPressed: disabled ? null : onEdit,
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Chỉnh sửa'),
                  ),
                  const SizedBox(width: 8),
                ],
                if (primary != null) Expanded(child: primary),
                if (canCancel || canCloseShort) ...[
                  const SizedBox(width: 4),
                  PopupMenuButton<_OrderOverflowAction>(
                    tooltip: 'Thêm hành động',
                    enabled: !disabled,
                    onSelected: (value) {
                      switch (value) {
                        case _OrderOverflowAction.cancel:
                          onCancel();
                          return;
                        case _OrderOverflowAction.closeShort:
                          onCloseShort();
                          return;
                      }
                    },
                    itemBuilder: (context) => [
                      if (canCancel)
                        const PopupMenuItem(
                          value: _OrderOverflowAction.cancel,
                          child: Text('Hủy đơn mua'),
                        ),
                      if (canCloseShort)
                        const PopupMenuItem(
                          value: _OrderOverflowAction.closeShort,
                          child: Text('Đóng thiếu'),
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

enum _OrderOverflowAction { cancel, closeShort }

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

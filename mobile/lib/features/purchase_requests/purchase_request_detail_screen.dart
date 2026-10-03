import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../purchase_orders/purchase_order_form.dart';
import 'purchase_request_form.dart';
import 'purchase_request_models.dart';
import 'purchase_requests_repository.dart';

class PurchaseRequestDetailScreen extends StatefulWidget {
  const PurchaseRequestDetailScreen({
    required this.requestId,
    super.key,
    this.repository,
  });

  final String requestId;
  final PurchaseRequestsRepository? repository;

  @override
  State<PurchaseRequestDetailScreen> createState() =>
      _PurchaseRequestDetailScreenState();
}

class _PurchaseRequestDetailScreenState
    extends State<PurchaseRequestDetailScreen> {
  late final PurchaseRequestsRepository _repository;
  PurchaseRequestDetail? _detail;
  String? _error;
  bool _loading = true;
  bool _acting = false;
  bool _addingQuote = false;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseRequestsRepository();
    _load();
  }

  Future<void> _load({bool showPageLoader = true}) async {
    setState(() {
      if (showPageLoader) _loading = true;
      _error = null;
    });
    try {
      final detail = await _repository.findOne(widget.requestId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = purchaseApiError(error);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(
        title: Text(detail?.requestCode ?? 'Chi tiết đề nghị'),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _DetailError(message: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _Header(detail: detail!),
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
              ),
            ),
      bottomNavigationBar: !_loading && _error == null && detail != null
          ? _RequestActionBar(
              detail: detail,
              disabled: _acting,
              addingQuote: _addingQuote,
              onAction: _handleAction,
              onChooseQuote: _chooseQuoteItem,
              onCreateOrder: _openPurchaseOrderForm,
            )
          : null,
    );
  }

  Future<void> _chooseQuoteItem() async {
    final items = [..._detail!.items]
      ..sort(
        (left, right) =>
            _quoteState(left).sortOrder.compareTo(_quoteState(right).sortOrder),
      );
    final item = await showModalBottomSheet<Map<String, dynamic>>(
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
    if (item != null) await _openQuoteDialog(item);
  }

  Future<void> _handleAction(String action) async {
    final detail = _detail!;
    if (action == 'edit') {
      final result = await Navigator.push<PurchaseRequestFormResult>(
        context,
        MaterialPageRoute(
          builder: (_) => PurchaseRequestFormScreen(
            initial: detail,
            repository: _repository,
          ),
        ),
      );
      if (result == PurchaseRequestFormResult.deleted) {
        if (mounted) Navigator.pop(context);
        return;
      }
      if (result == PurchaseRequestFormResult.saved) await _load();
      return;
    }

    if (action == 'submit_procurement') {
      await _run(() => _repository.submitProcurement(detail.id));
      return;
    }
    if (action == 'submit') {
      final confirmed = await _confirmSubmit();
      if (confirmed) await _run(() => _repository.submit(detail.id));
      return;
    }

    final endpoint = switch (action) {
      'department' => 'approve-department',
      'procurement' => 'approve-procurement',
      'it' => 'approve-it',
      _ => throw StateError('Unsupported action'),
    };
    final decision = await _decisionDialog();
    if (decision == null) return;
    await _run(
      () => _repository.decide(
        detail.id,
        endpoint,
        approved: decision.approved,
        reason: decision.reason,
      ),
    );
  }

  Future<void> _run(
    Future<void> Function() action, {
    bool addingQuote = false,
  }) async {
    if (_acting) return;
    setState(() {
      _acting = true;
      _addingQuote = addingQuote;
    });
    try {
      await action();
      if (!mounted) return;
      await _load(showPageLoader: false);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseApiError(error))));
    } finally {
      if (mounted) {
        setState(() {
          _acting = false;
          _addingQuote = false;
        });
      }
    }
  }

  Future<bool> _confirmSubmit() async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Gửi đề nghị?'),
            content: const Text('Nội dung sẽ bị khóa trong quá trình ký.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Hủy'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Gửi'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<_Decision?> _decisionDialog() async {
    final reason = TextEditingController();
    bool approved = true;
    final result = await showDialog<_Decision>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Quyết định'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: true, label: Text('Duyệt')),
                  ButtonSegment(value: false, label: Text('Trả về')),
                ],
                selected: {approved},
                onSelectionChanged: (values) {
                  setDialogState(() => approved = values.first);
                },
              ),
              if (!approved)
                TextField(
                  controller: reason,
                  decoration: const InputDecoration(
                    labelText: 'Lý do bắt buộc',
                  ),
                  maxLines: 3,
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () {
                if (!approved && reason.text.trim().isEmpty) return;
                Navigator.pop(context, _Decision(approved, reason.text.trim()));
              },
              child: const Text('Xác nhận'),
            ),
          ],
        ),
      ),
    );
    reason.dispose();
    return result;
  }

  Future<void> _openQuoteDialog(Map<String, dynamic> item) async {
    try {
      final suppliers = await _repository.suppliers();
      if (!mounted) return;
      final input = await showDialog<_QuoteInput>(
        context: context,
        builder: (_) => _QuoteDialog(suppliers: suppliers, item: item),
      );
      if (input == null) return;
      await _run(
        () => _repository.addQuote(
          requestId: _detail!.id,
          requestItemId: item['id'] as String,
          supplierId: input.supplierId,
          unitPriceExclVat: input.price,
          vatRate: input.vat,
          isSelected: input.selected,
          image: input.image,
          note: input.note,
        ),
        addingQuote: true,
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseApiError(error))));
    }
  }

  /// Mở form PO đã cố định request hiện tại rồi tải lại detail khi lưu thành công.
  Future<void> _openPurchaseOrderForm() async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PurchaseOrderFormScreen(initialRequestId: _detail!.id),
      ),
    );
    if (changed == true) await _load();
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

class _RequestActionBar extends StatelessWidget {
  const _RequestActionBar({
    required this.detail,
    required this.disabled,
    required this.addingQuote,
    required this.onAction,
    required this.onChooseQuote,
    required this.onCreateOrder,
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
                                  ? 'Đang lưu báo giá…'
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

class _QuoteDialog extends StatefulWidget {
  const _QuoteDialog({required this.suppliers, required this.item});

  final List<PurchaseSupplierOption> suppliers;
  final Map<String, dynamic> item;

  @override
  State<_QuoteDialog> createState() => _QuoteDialogState();
}

class _QuoteDialogState extends State<_QuoteDialog> {
  final _formKey = GlobalKey<FormState>();
  final _price = TextEditingController();
  final _vat = TextEditingController(text: '8.00');
  final _note = TextEditingController();
  String? _supplierId;
  XFile? _image;
  bool _selected = true;

  @override
  void dispose() {
    _price.dispose();
    _vat.dispose();
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Thêm báo giá'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _QuoteItemContext(item: widget.item),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _supplierId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Nhà cung cấp *'),
                items: widget.suppliers
                    .map(
                      (supplier) => DropdownMenuItem(
                        value: supplier.id,
                        child: Text(
                          supplier.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(() => _supplierId = value),
                validator: (value) =>
                    value == null ? 'Chọn nhà cung cấp.' : null,
              ),
              TextFormField(
                controller: _price,
                decoration: const InputDecoration(
                  labelText: 'Đơn giá chưa VAT (VND) *',
                ),
                keyboardType: TextInputType.number,
                validator: (value) => RegExp(r'^\d+$').hasMatch(value ?? '')
                    ? null
                    : 'Nhập số nguyên không âm.',
              ),
              TextFormField(
                controller: _vat,
                decoration: const InputDecoration(labelText: 'VAT % *'),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                validator: (value) {
                  final vat = double.tryParse(value ?? '');
                  return vat == null || vat < 0 || vat > 100
                      ? 'VAT phải từ 0 đến 100.'
                      : null;
                },
              ),
              TextFormField(
                controller: _note,
                decoration: const InputDecoration(labelText: 'Ghi chú'),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Chọn báo giá này'),
                value: _selected,
                onChanged: (value) => setState(() => _selected = value),
              ),
              if (_selected && _hasSelectedQuote(widget.item))
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Báo giá đang chọn trước đó sẽ được thay thế.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final image = await ImagePicker().pickImage(
                      source: ImageSource.gallery,
                    );
                    if (image != null) setState(() => _image = image);
                  },
                  icon: const Icon(Icons.image_outlined),
                  label: Text(
                    _image?.name ?? 'Chọn ảnh báo giá *',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: () {
            if (!_formKey.currentState!.validate() || _image == null) return;
            Navigator.pop(
              context,
              _QuoteInput(
                supplierId: _supplierId!,
                price: _price.text,
                vat: _vat.text,
                selected: _selected,
                image: _image!,
                note: _note.text.trim(),
              ),
            );
          },
          child: const Text('Lưu'),
        ),
      ],
    );
  }
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
  if (_hasSelectedQuote(item)) return _QuoteState.selected;

  return _QuoteState.unselected;
}

bool _hasSelectedQuote(Map<String, dynamic> item) {
  final quotes = item['quotes'];

  return quotes is List &&
      quotes.any((quote) => quote is Map && quote['isSelected'] == true);
}

class _QuoteProgress {
  const _QuoteProgress({
    required this.total,
    required this.completed,
    required this.missingNames,
  });

  factory _QuoteProgress.fromItems(List<Map<String, dynamic>> items) {
    final missing = items
        .where((item) => !_hasSelectedQuote(item))
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

class _QuoteStateChip extends StatelessWidget {
  const _QuoteStateChip({required this.state});

  final _QuoteState state;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final selected = state == _QuoteState.selected;

    return Chip(
      visualDensity: VisualDensity.compact,
      label: Text(state.label),
      backgroundColor: selected
          ? colorScheme.primaryContainer
          : colorScheme.surfaceContainerHighest,
      side: BorderSide.none,
    );
  }
}

class _QuoteItemContext extends StatelessWidget {
  const _QuoteItemContext({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final specifications = item['specifications']?.toString() ?? '';

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.inventory_2_outlined, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Báo giá cho',
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                  Text(
                    item['itemName']?.toString() ?? 'Hạng mục',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    '${item['categoryName']} • Số lượng ${item['quantity']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (specifications.isNotEmpty)
                    Text(
                      specifications,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Decision {
  const _Decision(this.approved, this.reason);
  final bool approved;
  final String reason;
}

class _QuoteInput {
  const _QuoteInput({
    required this.supplierId,
    required this.price,
    required this.vat,
    required this.selected,
    required this.image,
    required this.note,
  });
  final String supplierId;
  final String price;
  final String vat;
  final bool selected;
  final XFile image;
  final String note;
}

class _DetailError extends StatelessWidget {
  const _DetailError({required this.message, required this.onRetry});
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

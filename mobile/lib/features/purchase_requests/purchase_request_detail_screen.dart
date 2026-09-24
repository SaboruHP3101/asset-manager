import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

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

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseRequestsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
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
                  const SizedBox(height: 16),
                  _ActionPanel(
                    detail: detail,
                    disabled: _acting,
                    onAction: _handleAction,
                    onAddQuote: _openQuoteDialog,
                  ),
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
                          '${purchaseStatusLabel(event['previousStatus']?.toString() ?? '')} → '
                          '${purchaseStatusLabel(event['newStatus']?.toString() ?? '')}'
                          '${event['reason'] == null ? '' : '\n${event['reason']}'}',
                        ),
                      ),
                ],
              ),
            ),
    );
  }

  Future<void> _handleAction(String action) async {
    final detail = _detail!;
    if (action == 'edit') {
      final changed = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => PurchaseRequestFormScreen(
            initial: detail,
            repository: _repository,
          ),
        ),
      );
      if (changed == true) await _load();
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

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _acting = true);
    try {
      await action();
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseApiError(error))));
      setState(() => _acting = false);
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
        builder: (_) => _QuoteDialog(suppliers: suppliers),
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
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseApiError(error))));
    }
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

class _ActionPanel extends StatelessWidget {
  const _ActionPanel({
    required this.detail,
    required this.disabled,
    required this.onAction,
    required this.onAddQuote,
  });

  final PurchaseRequestDetail detail;
  final bool disabled;
  final ValueChanged<String> onAction;
  final ValueChanged<Map<String, dynamic>> onAddQuote;

  @override
  Widget build(BuildContext context) {
    final buttons = <Widget>[];
    if (detail.allows('purchase.request.update')) {
      buttons.add(
        OutlinedButton.icon(
          onPressed: disabled ? null : () => onAction('edit'),
          icon: const Icon(Icons.edit),
          label: const Text('Chỉnh sửa'),
        ),
      );
    }
    if (detail.allows('purchase.request.submit')) {
      buttons.add(
        FilledButton(
          onPressed: disabled ? null : () => onAction('submit'),
          child: const Text('Gửi trình ký'),
        ),
      );
    }
    if (detail.allows('purchase.request.approve_department')) {
      buttons.add(
        FilledButton(
          onPressed: disabled ? null : () => onAction('department'),
          child: const Text('Xử lý cấp phòng'),
        ),
      );
    }
    if (detail.allows('purchase.request.enrich_procurement')) {
      buttons.addAll([
        for (final item in detail.items)
          OutlinedButton(
            onPressed: disabled ? null : () => onAddQuote(item),
            child: Text('Thêm báo giá: ${item['itemName']}'),
          ),
        FilledButton(
          onPressed: disabled ? null : () => onAction('submit_procurement'),
          child: const Text('Trình Trưởng Thu mua'),
        ),
      ]);
    }
    if (detail.allows('purchase.request.approve_procurement')) {
      buttons.add(
        FilledButton(
          onPressed: disabled ? null : () => onAction('procurement'),
          child: const Text('Duyệt thương mại'),
        ),
      );
    }
    if (detail.allows('purchase.request.approve_it')) {
      buttons.add(
        FilledButton(
          onPressed: disabled ? null : () => onAction('it'),
          child: const Text('Duyệt chuyên môn IT'),
        ),
      );
    }
    if (buttons.isEmpty) return const SizedBox.shrink();
    return Semantics(
      label: 'Hành động có thể thực hiện',
      child: Wrap(spacing: 8, runSpacing: 8, children: buttons),
    );
  }
}

class _QuoteDialog extends StatefulWidget {
  const _QuoteDialog({required this.suppliers});

  final List<PurchaseSupplierOption> suppliers;

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
            children: [
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

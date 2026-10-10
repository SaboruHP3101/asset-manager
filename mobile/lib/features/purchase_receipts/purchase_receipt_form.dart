import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/widgets/code_scanner_screen.dart';
import 'purchase_receipt_models.dart';
import 'purchase_receipts_repository.dart';

class PurchaseReceiptFormScreen extends StatefulWidget {
  const PurchaseReceiptFormScreen({
    required this.orderId,
    super.key,
    this.repository,
    this.scanner,
  });

  final String orderId;
  final PurchaseReceiptsRepository? repository;
  final CodeScannerLauncher? scanner;

  @override
  State<PurchaseReceiptFormScreen> createState() =>
      _PurchaseReceiptFormScreenState();
}

class _PurchaseReceiptFormScreenState extends State<PurchaseReceiptFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _deliveryDate = TextEditingController();
  final _deliveryNoteNumber = TextEditingController();
  final _picker = ImagePicker();
  late final PurchaseReceiptsRepository _repository;
  late final CodeScannerLauncher _scanner;
  final Map<String, TextEditingController> _quantities = {};
  final Map<String, TextEditingController> _serials = {};
  List<PurchaseReceiptProgress>? _items;
  XFile? _deliveryNote;
  XFile? _invoice;
  XFile? _warranty;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseReceiptsRepository();
    _scanner = widget.scanner ?? openCodeScanner;
    final now = DateTime.now();
    _deliveryDate.text =
        '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await _repository.findOrderProgress(widget.orderId);
      for (final item in items) {
        _quantities[item.purchaseOrderItemId] = TextEditingController(
          text: '0',
        );
        _serials[item.purchaseOrderItemId] = TextEditingController();
      }
      if (mounted) setState(() => _items = items);
    } catch (error) {
      if (mounted) setState(() => _error = purchaseReceiptApiError(error));
    }
  }

  @override
  void dispose() {
    _deliveryDate.dispose();
    _deliveryNoteNumber.dispose();
    for (final controller in [..._quantities.values, ..._serials.values]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Ghi nhận đợt giao')),
    body: _error != null
        ? Center(child: Text(_error!, textAlign: TextAlign.center))
        : _items == null
        ? const Center(child: CircularProgressIndicator())
        : Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextFormField(
                  controller: _deliveryDate,
                  readOnly: true,
                  decoration: const InputDecoration(
                    labelText: 'Ngày giao',
                    suffixIcon: Icon(Icons.calendar_today_outlined),
                  ),
                  onTap: _pickDate,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: const ValueKey('delivery-note-number'),
                  controller: _deliveryNoteNumber,
                  decoration: InputDecoration(
                    labelText: 'Số phiếu giao hàng',
                    suffixIcon: IconButton(
                      onPressed: _scanDeliveryNoteNumber,
                      tooltip: 'Quét số phiếu giao hàng',
                      icon: const Icon(Icons.qr_code_scanner),
                    ),
                  ),
                  validator: (value) => value?.trim().isEmpty ?? true
                      ? 'Nhập số phiếu giao hàng.'
                      : null,
                ),
                const SizedBox(height: 20),
                Text(
                  'Số lượng giao',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                for (final item in _items!) _line(item),
                const SizedBox(height: 16),
                _fileButton(
                  label: 'Ảnh phiếu giao hàng *',
                  file: _deliveryNote,
                  onSelected: (file) => setState(() => _deliveryNote = file),
                ),
                _fileButton(
                  label: 'Ảnh hóa đơn (tùy chọn)',
                  file: _invoice,
                  onSelected: (file) => setState(() => _invoice = file),
                ),
                _fileButton(
                  label: 'Ảnh bảo hành (tùy chọn)',
                  file: _warranty,
                  onSelected: (file) => setState(() => _warranty = file),
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: _saving ? null : _submit,
                  icon: _saving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.local_shipping_outlined),
                  label: const Text('Ghi nhận đợt giao'),
                ),
              ],
            ),
          ),
  );

  Widget _line(PurchaseReceiptProgress item) {
    final itemId = item.purchaseOrderItemId;
    final serialCount = _serialList(_serials[itemId]?.text).length;
    final quantity = int.tryParse(_quantities[itemId]?.text ?? '') ?? 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item.itemName, style: Theme.of(context).textTheme.titleMedium),
            Text(
              'Đặt ${item.ordered} • Đã giao ${item.delivered} • '
              'Đạt ${item.accepted} • Không đạt ${item.rejected} • '
              'Còn có thể giao ${item.remaining}',
            ),
            const SizedBox(height: 8),
            TextFormField(
              key: ValueKey('receipt-quantity-$itemId'),
              controller: _quantities[itemId],
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Số lượng đợt này'),
              onChanged: (_) => setState(() {}),
              validator: (value) {
                final valueAsNumber = int.tryParse(value ?? '');
                if (valueAsNumber == null || valueAsNumber < 0) {
                  return 'Số lượng không hợp lệ.';
                }
                if (valueAsNumber > item.remaining) {
                  return 'Tối đa ${item.remaining}.';
                }
                return null;
              },
            ),
            if (item.trackingMode == 'individual_asset') ...[
              const SizedBox(height: 8),
              TextFormField(
                key: ValueKey('receipt-serials-$itemId'),
                controller: _serials[itemId],
                minLines: 2,
                maxLines: 5,
                decoration: InputDecoration(
                  labelText: 'Mã sản phẩm (mỗi dòng một mã)',
                  helperText: 'Đã có $serialCount/$quantity mã',
                  suffixIcon: IconButton(
                    onPressed: () => _scanSerials(item),
                    tooltip: 'Quét mã ${item.itemName}',
                    icon: const Icon(Icons.qr_code_scanner),
                  ),
                ),
                onChanged: (_) => setState(() {}),
                validator: (value) => _validateSerials(item, value),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _fileButton({
    required String label,
    required XFile? file,
    required ValueChanged<XFile> onSelected,
  }) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: const Icon(Icons.add_photo_alternate_outlined),
    title: Text(label),
    subtitle: Text(file?.name ?? 'Chưa chọn ảnh'),
    trailing: const Icon(Icons.chevron_right),
    onTap: () async {
      final selected = await _picker.pickImage(source: ImageSource.gallery);
      if (selected != null) onSelected(selected);
    },
  );

  Future<void> _pickDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_deliveryDate.text) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (selected == null) return;
    _deliveryDate.text = selected.toIso8601String().split('T').first;
  }

  List<String> _serialList(String? value) => (value ?? '')
      .split(RegExp(r'[\r\n]+'))
      .map((serial) => serial.trim())
      .where((serial) => serial.isNotEmpty)
      .toList();

  String? _validateSerials(PurchaseReceiptProgress item, String? value) {
    final serials = _serialList(value);
    final quantity =
        int.tryParse(_quantities[item.purchaseOrderItemId]?.text ?? '') ?? 0;
    if (serials.length != serials.toSet().length) {
      return 'Danh sách có mã bị trùng.';
    }
    if (serials.any(_serialIsUsedInAnotherItem(item.purchaseOrderItemId))) {
      return 'Mã đã được dùng ở hạng mục khác.';
    }
    if (serials.length != quantity) {
      return 'Cần đủ $quantity mã cho $quantity sản phẩm.';
    }
    return null;
  }

  bool Function(String) _serialIsUsedInAnotherItem(String itemId) =>
      (serial) => _serials.entries.any(
        (entry) =>
            entry.key != itemId &&
            _serialList(entry.value.text).contains(serial),
      );

  Future<void> _scanSerials(PurchaseReceiptProgress item) async {
    final itemId = item.purchaseOrderItemId;
    final quantity = int.tryParse(_quantities[itemId]?.text ?? '') ?? 0;
    if (quantity <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nhập số lượng giao trước khi quét mã.')),
      );
      return;
    }

    final serials = await _scanner(
      context,
      title: 'Quét mã ${item.itemName}',
      targetCount: quantity,
      initialCodes: _serialList(_serials[itemId]?.text),
    );
    if (serials == null || !mounted) return;
    setState(() => _serials[itemId]!.text = serials.join('\n'));
  }

  Future<void> _scanDeliveryNoteNumber() async {
    final codes = await _scanner(
      context,
      title: 'Quét số phiếu giao hàng',
      targetCount: 1,
      initialCodes: const [],
    );
    if (codes == null || codes.isEmpty || !mounted) return;
    setState(() => _deliveryNoteNumber.text = codes.first);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_deliveryNote == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chọn ảnh phiếu giao hàng.')),
      );
      return;
    }
    final quantities = {
      for (final entry in _quantities.entries)
        entry.key: int.parse(entry.value.text),
    };
    if (quantities.values.every((quantity) => quantity == 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nhập ít nhất một số lượng giao.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await _repository.record(
        orderId: widget.orderId,
        deliveryDate: _deliveryDate.text,
        deliveryNoteNumber: _deliveryNoteNumber.text.trim(),
        quantities: quantities,
        serialNumbers: {
          for (final entry in _serials.entries)
            entry.key: _serialList(entry.value.text),
        },
        deliveryNote: _deliveryNote!,
        invoice: _invoice,
        warranty: _warranty,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(purchaseReceiptApiError(error))));
    }
  }
}

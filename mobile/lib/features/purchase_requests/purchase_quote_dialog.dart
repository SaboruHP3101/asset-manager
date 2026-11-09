import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'purchase_request_models.dart';

/// Collects a supplier quote and returns the form values when saved.
class PurchaseQuoteDialog extends StatefulWidget {
  const PurchaseQuoteDialog({
    required this.suppliers,
    required this.item,
    required this.hasSelectedQuote,
    super.key,
  });

  final List<PurchaseSupplierOption> suppliers;
  final Map<String, dynamic> item;
  final bool hasSelectedQuote;

  @override
  State<PurchaseQuoteDialog> createState() => _PurchaseQuoteDialogState();
}

class _PurchaseQuoteDialogState extends State<PurchaseQuoteDialog> {
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
              if (_selected && widget.hasSelectedQuote)
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
              PurchaseQuoteInput(
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

/// The validated quote form values returned to the request detail screen.
class PurchaseQuoteInput {
  const PurchaseQuoteInput({
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

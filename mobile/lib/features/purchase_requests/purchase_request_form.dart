import 'package:flutter/material.dart';

import 'purchase_request_models.dart';
import 'purchase_requests_repository.dart';

class PurchaseRequestFormScreen extends StatefulWidget {
  const PurchaseRequestFormScreen({super.key, this.initial, this.repository});

  final PurchaseRequestDetail? initial;
  final PurchaseRequestsRepository? repository;

  @override
  State<PurchaseRequestFormScreen> createState() =>
      _PurchaseRequestFormScreenState();
}

class _PurchaseRequestFormScreenState extends State<PurchaseRequestFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final PurchaseRequestsRepository _repository;
  late final TextEditingController _purposeController;
  late final TextEditingController _noteController;
  late DateTime _neededByDate;
  final List<_ItemControllers> _items = [];
  List<PurchaseCategoryOption> _categories = [];
  bool _loading = true;
  bool _saving = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseRequestsRepository();
    _purposeController = TextEditingController(text: widget.initial?.purpose);
    _noteController = TextEditingController(text: widget.initial?.note);
    _neededByDate = widget.initial == null
        ? DateTime.now().add(const Duration(days: 14))
        : DateTime.parse(widget.initial!.neededByDate);
    if (widget.initial == null) {
      _items.add(_ItemControllers());
    } else {
      _items.addAll(
        widget.initial!.items.map(
          (item) => _ItemControllers(
            categoryId: item['assetCategoryId'] as String,
            itemName: item['itemName'] as String,
            specifications: item['specifications'] as String,
            quantity: (item['quantity'] as int).toString(),
            purpose: item['purpose'] as String?,
          ),
        ),
      );
    }
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await _repository.categories();
      if (!mounted) return;
      setState(() {
        _categories = categories;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = purchaseApiError(error);
        _loading = false;
      });
    }
  }

  Future<void> _save({required bool submit}) async {
    if (!_formKey.currentState!.validate()) return;
    if (submit) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Gửi đề nghị?'),
          content: const Text(
            'Sau khi gửi, nội dung sẽ bị khóa cho đến khi đề nghị được trả về để điều chỉnh.',
          ),
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
      );
      if (confirmed != true) return;
    }

    setState(() => _saving = true);
    try {
      final detail = await _repository.save(
        id: widget.initial?.id,
        neededByDate: _dateText(_neededByDate),
        purpose: _purposeController.text.trim(),
        note: _noteController.text.trim(),
        items: _items
            .map(
              (item) => PurchaseRequestItemDraft(
                assetCategoryId: item.categoryId!,
                itemName: item.itemName.text.trim(),
                specifications: item.specifications.text.trim(),
                quantity: int.parse(item.quantity.text),
                purpose: item.purpose.text.trim(),
              ),
            )
            .toList(),
      );
      if (submit) await _repository.submit(detail.id);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseApiError(error))));
      setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _purposeController.dispose();
    _noteController.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.initial == null ? 'Tạo đề nghị mua' : 'Sửa đề nghị'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
          ? _ErrorState(message: _loadError!, onRetry: _loadCategories)
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Semantics(
                    label: 'Ngày cần tài sản',
                    button: true,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Ngày cần tài sản'),
                      subtitle: Text(_dateText(_neededByDate)),
                      trailing: const Icon(Icons.calendar_month),
                      onTap: _pickDate,
                    ),
                  ),
                  TextFormField(
                    controller: _purposeController,
                    decoration: const InputDecoration(
                      labelText: 'Mục đích sử dụng *',
                    ),
                    maxLines: 2,
                    textInputAction: TextInputAction.next,
                    validator: _required,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _noteController,
                    decoration: const InputDecoration(labelText: 'Ghi chú'),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Hạng mục',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () =>
                            setState(() => _items.add(_ItemControllers())),
                        icon: const Icon(Icons.add),
                        label: const Text('Thêm'),
                      ),
                    ],
                  ),
                  for (var index = 0; index < _items.length; index++) ...[
                    _PurchaseRequestItemEditor(
                      key: ValueKey(_items[index]),
                      index: index,
                      controllers: _items[index],
                      categories: _categories,
                      canRemove: _items.length > 1,
                      onRemove: () => setState(() {
                        final removed = _items.removeAt(index);
                        removed.dispose();
                      }),
                    ),
                    const SizedBox(height: 12),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _saving
                              ? null
                              : () => _save(submit: false),
                          child: const Text('Lưu nháp'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _saving ? null : () => _save(submit: true),
                          child: _saving
                              ? const SizedBox.square(
                                  dimension: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Lưu và gửi'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _neededByDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (date != null) setState(() => _neededByDate = date);
  }

  String? _required(String? value) => value == null || value.trim().isEmpty
      ? 'Vui lòng nhập thông tin này.'
      : null;

  String _dateText(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}

class _PurchaseRequestItemEditor extends StatelessWidget {
  const _PurchaseRequestItemEditor({
    required this.index,
    required this.controllers,
    required this.categories,
    required this.canRemove,
    required this.onRemove,
    super.key,
  });

  final int index;
  final _ItemControllers controllers;
  final List<PurchaseCategoryOption> categories;
  final bool canRemove;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(child: Text('Hạng mục ${index + 1}')),
                IconButton(
                  tooltip: 'Xóa hạng mục ${index + 1}',
                  onPressed: canRemove ? onRemove : null,
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
            DropdownButtonFormField<String>(
              initialValue: controllers.categoryId,
              decoration: const InputDecoration(labelText: 'Danh mục *'),
              items: categories
                  .map(
                    (category) => DropdownMenuItem(
                      value: category.id,
                      child: Text(category.name),
                    ),
                  )
                  .toList(),
              onChanged: (value) => controllers.categoryId = value,
              validator: (value) => value == null ? 'Chọn danh mục.' : null,
            ),
            TextFormField(
              controller: controllers.itemName,
              decoration: const InputDecoration(labelText: 'Tên tài sản *'),
              textInputAction: TextInputAction.next,
              validator: _required,
            ),
            TextFormField(
              controller: controllers.specifications,
              decoration: const InputDecoration(
                labelText: 'Mô tả / thông số *',
              ),
              maxLines: 2,
              validator: _required,
            ),
            TextFormField(
              controller: controllers.quantity,
              decoration: const InputDecoration(labelText: 'Số lượng *'),
              keyboardType: TextInputType.number,
              validator: (value) {
                final quantity = int.tryParse(value ?? '');
                return quantity == null || quantity < 1
                    ? 'Số lượng phải lớn hơn 0.'
                    : null;
              },
            ),
            TextFormField(
              controller: controllers.purpose,
              decoration: const InputDecoration(
                labelText: 'Mục đích riêng (nếu có)',
              ),
            ),
          ],
        ),
      ),
    );
  }

  String? _required(String? value) => value == null || value.trim().isEmpty
      ? 'Vui lòng nhập thông tin này.'
      : null;
}

class _ItemControllers {
  _ItemControllers({
    this.categoryId,
    String? itemName,
    String? specifications,
    String? quantity,
    String? purpose,
  }) : itemName = TextEditingController(text: itemName),
       specifications = TextEditingController(text: specifications),
       quantity = TextEditingController(text: quantity ?? '1'),
       purpose = TextEditingController(text: purpose);

  String? categoryId;
  final TextEditingController itemName;
  final TextEditingController specifications;
  final TextEditingController quantity;
  final TextEditingController purpose;

  void dispose() {
    itemName.dispose();
    specifications.dispose();
    quantity.dispose();
    purpose.dispose();
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ),
      ),
    );
  }
}

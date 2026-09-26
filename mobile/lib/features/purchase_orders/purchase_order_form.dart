import 'package:flutter/material.dart';

import 'purchase_order_models.dart';
import 'purchase_orders_repository.dart';

class PurchaseOrderFormScreen extends StatefulWidget {
  const PurchaseOrderFormScreen({
    super.key,
    this.repository,
    this.initialRequestId,
    this.initial,
  });

  final PurchaseOrdersRepository? repository;
  final String? initialRequestId;
  final PurchaseOrderDetail? initial;

  /// Tạo state quản lý dữ liệu tải về
  @override
  State<PurchaseOrderFormScreen> createState() =>
      _PurchaseOrderFormScreenState();
}

class _PurchaseOrderFormScreenState extends State<PurchaseOrderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final PurchaseOrdersRepository _repository;
  final _orderDate = TextEditingController();
  final _deliveryDate = TextEditingController();
  final Map<String, TextEditingController> _quantities = {};
  List<EligiblePurchaseOrderItem>? _eligible;
  String? _requestId;
  String? _supplierId;
  String? _error;
  bool _saving = false;

  /// Khởi tạo repository, ngày mặc định và tải quantity còn lại
  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseOrdersRepository();
    final initial = widget.initial;
    _requestId = initial?.purchaseRequestId ?? widget.initialRequestId;
    _supplierId = initial?.supplierId;
    _orderDate.text = initial?.orderDate ?? _today();
    _deliveryDate.text = initial?.expectedDeliveryDate ?? _today();
    _load();
  }

  @override
  void dispose() {
    _orderDate.dispose();
    _deliveryDate.dispose();
    for (final controller in _quantities.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final eligible = await _repository.findEligibleRequests();
      final initial = widget.initial;
      if (initial != null) {
        for (final item in initial.items) {
          final itemId = item['purchaseRequestItemId'] as String;
          final existingIndex = eligible.indexWhere(
            (candidate) => candidate.itemId == itemId,
          );
          final currentQuantity = item['quantity'] as int;
          if (existingIndex >= 0) {
            final current = eligible[existingIndex];
            eligible[existingIndex] = EligiblePurchaseOrderItem(
              requestId: current.requestId,
              requestCode: current.requestCode,
              itemId: current.itemId,
              itemName: current.itemName,
              remainingQuantity: current.remainingQuantity + currentQuantity,
              supplierId: current.supplierId,
              supplierName: current.supplierName,
            );
          } else {
            eligible.add(
              EligiblePurchaseOrderItem(
                requestId: initial.purchaseRequestId,
                requestCode: initial.requestCode,
                itemId: itemId,
                itemName: item['itemNameSnapshot'] as String,
                remainingQuantity: currentQuantity,
                supplierId: initial.supplierId,
                supplierName: initial.supplierName,
              ),
            );
          }
          _quantities[itemId] = TextEditingController(
            text: currentQuantity.toString(),
          );
        }
      }
      if (_requestId != null &&
          !eligible.any((item) => item.requestId == _requestId)) {
        _requestId = null;
        _supplierId = null;
      }
      if (!mounted) return;
      setState(() => _eligible = eligible);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = purchaseOrderApiError(error));
    }
  }

  List<EligiblePurchaseOrderItem> get _requests {
    final seen = <String>{};
    return (_eligible ?? []).where((item) => seen.add(item.requestId)).toList();
  }

  List<EligiblePurchaseOrderItem> get _suppliers {
    final seen = <String>{};
    return (_eligible ?? [])
        .where(
          (item) => item.requestId == _requestId && seen.add(item.supplierId),
        )
        .toList();
  }

  List<EligiblePurchaseOrderItem> get _items => (_eligible ?? [])
      .where(
        (item) =>
            item.requestId == _requestId && item.supplierId == _supplierId,
      )
      .toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.initial == null ? 'Tạo đơn đặt mua' : 'Sửa đơn đặt mua',
        ),
      ),
      body: _error != null
          ? _FormMessage(message: _error!, onRetry: _load)
          : _eligible == null
          ? const Center(child: CircularProgressIndicator())
          : _requests.isEmpty
          ? const _FormMessage(
              message: 'Không có hạng mục nào còn số lượng để đặt mua.',
            )
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _requestId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Đề nghị *'),
                    items: _requests
                        .map(
                          (item) => DropdownMenuItem(
                            value: item.requestId,
                            child: Text(item.requestCode),
                          ),
                        )
                        .toList(),
                    onChanged: widget.initial != null
                        ? null
                        : (value) => setState(() {
                            _requestId = value;
                            _supplierId = null;
                            _clearQuantities();
                          }),
                    validator: (value) =>
                        value == null ? 'Chọn đề nghị.' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey(_requestId),
                    initialValue: _supplierId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Nhà cung cấp *',
                    ),
                    items: _suppliers
                        .map(
                          (item) => DropdownMenuItem(
                            value: item.supplierId,
                            child: Text(
                              item.supplierName,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: widget.initial != null
                        ? null
                        : (value) => setState(() {
                            _supplierId = value;
                            _clearQuantities();
                          }),
                    validator: (value) =>
                        value == null ? 'Chọn nhà cung cấp.' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _orderDate,
                    readOnly: true,
                    decoration: const InputDecoration(labelText: 'Ngày đặt *'),
                    onTap: () => _pickDate(_orderDate),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _deliveryDate,
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Ngày giao dự kiến *',
                    ),
                    onTap: () => _pickDate(_deliveryDate),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Hạng mục',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (_supplierId != null && _items.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        'Nhà cung cấp này không còn hạng mục để đặt.',
                      ),
                    ),
                  for (final item in _items) _quantityField(item),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined),
                    label: const Text('Lưu PO nháp'),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _quantityField(EligiblePurchaseOrderItem item) {
    final controller = _quantities.putIfAbsent(
      item.itemId,
      () => TextEditingController(text: '0'),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '${item.itemName}\nCòn có thể đặt: ${item.remainingQuantity}',
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 90,
              child: TextFormField(
                controller: controller,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Số lượng'),
                validator: (value) {
                  final quantity = int.tryParse(value ?? '');
                  if (quantity == null || quantity < 0) return 'Không hợp lệ';
                  if (quantity > item.remainingQuantity) return 'Vượt quá';
                  return null;
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDate(TextEditingController controller) async {
    final selected = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(controller.text) ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (selected != null) controller.text = _formatDate(selected);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final quantities = <String, int>{
      for (final item in _items)
        item.itemId: int.tryParse(_quantities[item.itemId]?.text ?? '') ?? 0,
    };
    if (!quantities.values.any((quantity) => quantity > 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chọn ít nhất một hạng mục có số lượng.')),
      );
      return;
    }
    if (_deliveryDate.text.compareTo(_orderDate.text) < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ngày giao không được trước ngày đặt.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await _repository.save(
        id: widget.initial?.id,
        purchaseRequestId: _requestId!,
        supplierId: _supplierId!,
        orderDate: _orderDate.text,
        expectedDeliveryDate: _deliveryDate.text,
        contractId: widget.initial?.contractId,
        quantities: quantities,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseOrderApiError(error))));
    }
  }

  String _today() => _formatDate(DateTime.now());

  void _clearQuantities() {
    for (final controller in _quantities.values) {
      controller.dispose();
    }
    _quantities.clear();
  }

  String _formatDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}

class _FormMessage extends StatelessWidget {
  const _FormMessage({required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null)
            FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

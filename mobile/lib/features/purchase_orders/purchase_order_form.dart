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

  @override
  State<PurchaseOrderFormScreen> createState() =>
      _PurchaseOrderFormScreenState();
}

class _PurchaseOrderFormScreenState extends State<PurchaseOrderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final PurchaseOrdersRepository _repository;
  final Map<String, TextEditingController> _quantities = {};
  late DateTime _orderDate;
  late DateTime _deliveryDate;
  List<EligiblePurchaseOrderItem>? _eligible;
  String? _requestId;
  String? _supplierId;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseOrdersRepository();
    final initial = widget.initial;
    _requestId = initial?.purchaseRequestId ?? widget.initialRequestId;
    _supplierId = initial?.supplierId;
    _orderDate = _parseApiDate(initial?.orderDate) ?? _today();
    _deliveryDate = _parseApiDate(initial?.expectedDeliveryDate) ?? _orderDate;
    _load();
  }

  @override
  void dispose() {
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

  EligiblePurchaseOrderItem? get _selectedRequest {
    for (final request in _requests) {
      if (request.requestId == _requestId) return request;
    }
    return null;
  }

  int get _selectedItemCount =>
      _items.where((item) => (_quantityFor(item) ?? 0) > 0).length;

  int get _totalQuantity => _items.fold(
    0,
    (total, item) => total + ((_quantityFor(item) ?? 0).clamp(0, 999999)),
  );

  bool get _hasValidQuantities => _items.every((item) {
    final quantity = _quantityFor(item);
    return quantity != null &&
        quantity >= 0 &&
        quantity <= item.remainingQuantity;
  });

  bool get _canSave =>
      !_saving &&
      _requestId != null &&
      _supplierId != null &&
      _selectedItemCount > 0 &&
      _hasValidQuantities &&
      !_deliveryDate.isBefore(_orderDate);

  String? get _actionHint {
    if (_requestId == null) return 'Chọn đề nghị để tiếp tục.';
    if (_supplierId == null) return 'Chọn nhà cung cấp để xem hạng mục.';
    if (!_hasValidQuantities) return 'Kiểm tra lại số lượng hạng mục.';
    if (_selectedItemCount == 0) {
      return 'Chọn ít nhất một hạng mục có số lượng.';
    }
    if (_deliveryDate.isBefore(_orderDate)) {
      return 'Ngày giao không được trước ngày đặt.';
    }
    return null;
  }

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
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  const _SectionTitle(
                    icon: Icons.description_outlined,
                    title: 'Thông tin đơn mua',
                  ),
                  const SizedBox(height: 12),
                  if (widget.initialRequestId != null &&
                      _selectedRequest != null)
                    _RequestCard(requestCode: _selectedRequest!.requestCode)
                  else
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
                    decoration: InputDecoration(
                      labelText: 'Nhà cung cấp *',
                      helperText: _requestId == null
                          ? 'Chọn đề nghị trước.'
                          : 'Chỉ hiển thị nhà cung cấp có báo giá được chọn.',
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
                    onChanged: widget.initial != null || _requestId == null
                        ? null
                        : (value) => setState(() {
                            _supplierId = value;
                            _clearQuantities();
                          }),
                    validator: (value) =>
                        value == null ? 'Chọn nhà cung cấp.' : null,
                  ),
                  const SizedBox(height: 12),
                  _dateField(
                    label: 'Ngày đặt *',
                    value: _orderDate,
                    onTap: () => _pickDate(isDeliveryDate: false),
                  ),
                  const SizedBox(height: 12),
                  _dateField(
                    label: 'Ngày giao dự kiến *',
                    value: _deliveryDate,
                    errorText: _deliveryDate.isBefore(_orderDate)
                        ? 'Ngày giao không được trước ngày đặt.'
                        : null,
                    onTap: () => _pickDate(isDeliveryDate: true),
                  ),
                  const SizedBox(height: 28),
                  const _SectionTitle(
                    icon: Icons.inventory_2_outlined,
                    title: 'Hạng mục đặt mua',
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Hạng mục được lọc theo báo giá đã chọn của nhà cung cấp.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  if (_requestId == null)
                    const _ItemsEmptyState(
                      icon: Icons.assignment_outlined,
                      message: 'Chọn đề nghị để xem nhà cung cấp và hạng mục.',
                    )
                  else if (_supplierId == null)
                    const _ItemsEmptyState(
                      icon: Icons.local_shipping_outlined,
                      message: 'Chọn nhà cung cấp để xem các hạng mục có thể đặt mua.',
                    )
                  else if (_items.isEmpty)
                    const _ItemsEmptyState(
                      icon: Icons.inventory_2_outlined,
                      message:
                          'Nhà cung cấp này không còn hạng mục để đặt mua.',
                    )
                  else
                    for (final item in _items) _quantityField(item),
                  if (_items.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _SummaryCard(
                      itemCount: _selectedItemCount,
                      quantity: _totalQuantity,
                    ),
                  ],
                ],
              ),
            ),
      bottomNavigationBar:
          _eligible == null || _error != null || _requests.isEmpty
          ? null
          : _PurchaseOrderActionBar(
              saving: _saving,
              enabled: _canSave,
              hint: _actionHint,
              onSave: _save,
            ),
    );
  }

  Widget _quantityField(EligiblePurchaseOrderItem item) {
    final controller = _quantities.putIfAbsent(
      item.itemId,
      () => TextEditingController(text: '0'),
    );
    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: (_quantityFor(item) ?? 0) > 0,
                  onChanged: (selected) =>
                      _setQuantity(item, selected == true ? 1 : 0),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.itemName,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Còn có thể đặt: ${item.remainingQuantity}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconButton.filledTonal(
                  tooltip: 'Giảm số lượng ${item.itemName}',
                  onPressed: (_quantityFor(item) ?? 0) <= 0
                      ? null
                      : () => _setQuantity(item, (_quantityFor(item) ?? 0) - 1),
                  icon: const Icon(Icons.remove),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: controller,
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Số lượng'),
                    onChanged: (_) => setState(() {}),
                    validator: (value) {
                      final quantity = int.tryParse(value ?? '');
                      if (quantity == null || quantity < 0) {
                        return 'Không hợp lệ';
                      }
                      if (quantity > item.remainingQuantity) {
                        return 'Tối đa ${item.remainingQuantity}';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filledTonal(
                  tooltip: 'Tăng số lượng ${item.itemName}',
                  onPressed: (_quantityFor(item) ?? 0) >= item.remainingQuantity
                      ? null
                      : () => _setQuantity(item, (_quantityFor(item) ?? 0) + 1),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateField({
    required String label,
    required DateTime value,
    required VoidCallback onTap,
    String? errorText,
  }) => Semantics(
    button: true,
    label: '$label, ${_formatDisplayDate(value)}',
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          errorText: errorText,
          suffixIcon: const Icon(Icons.calendar_today_outlined),
        ),
        child: Text(_formatDisplayDate(value)),
      ),
    ),
  );

  int? _quantityFor(EligiblePurchaseOrderItem item) =>
      int.tryParse(_quantities[item.itemId]?.text ?? '0');

  void _setQuantity(EligiblePurchaseOrderItem item, int quantity) {
    final controller = _quantities.putIfAbsent(
      item.itemId,
      () => TextEditingController(text: '0'),
    );
    controller.text = quantity.clamp(0, item.remainingQuantity).toString();
    setState(() {});
  }

  Future<void> _pickDate({required bool isDeliveryDate}) async {
    final current = isDeliveryDate ? _deliveryDate : _orderDate;
    final firstDate = isDeliveryDate
        ? _orderDate
        : DateTime.now().subtract(const Duration(days: 365));
    final selected = await showDatePicker(
      context: context,
      initialDate: current.isBefore(firstDate) ? firstDate : current,
      firstDate: firstDate,
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (selected == null) return;
    setState(() {
      if (isDeliveryDate) {
        _deliveryDate = selected;
      } else {
        _orderDate = selected;
      }
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || !_canSave) return;
    final quantities = <String, int>{
      for (final item in _items)
        item.itemId: int.tryParse(_quantities[item.itemId]?.text ?? '') ?? 0,
    };
    setState(() => _saving = true);
    try {
      await _repository.save(
        id: widget.initial?.id,
        purchaseRequestId: _requestId!,
        supplierId: _supplierId!,
        orderDate: _formatApiDate(_orderDate),
        expectedDeliveryDate: _formatApiDate(_deliveryDate),
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

  DateTime _today() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  void _clearQuantities() {
    for (final controller in _quantities.values) {
      controller.dispose();
    }
    _quantities.clear();
  }

  DateTime? _parseApiDate(String? value) =>
      value == null ? null : DateTime.tryParse(value);

  String _formatApiDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  String _formatDisplayDate(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/'
      '${date.month.toString().padLeft(2, '0')}/'
      '${date.year}';
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 8),
      Text(title, style: Theme.of(context).textTheme.titleMedium),
    ],
  );
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.requestCode});

  final String requestCode;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: ListTile(
      leading: const Icon(Icons.assignment_turned_in_outlined),
      title: const Text('Đề nghị'),
      subtitle: Text(requestCode),
      trailing: const Icon(Icons.lock_outline, size: 20),
    ),
  );
}

class _ItemsEmptyState extends StatelessWidget {
  const _ItemsEmptyState({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.onSurfaceVariant),
        const SizedBox(height: 10),
        Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    ),
  );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.itemCount, required this.quantity});

  final int itemCount;
  final int quantity;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Icon(Icons.summarize_outlined),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '$itemCount hạng mục · Tổng số lượng: $quantity',
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
        ],
      ),
    ),
  );
}

class _PurchaseOrderActionBar extends StatelessWidget {
  const _PurchaseOrderActionBar({
    required this.saving,
    required this.enabled,
    required this.hint,
    required this.onSave,
  });

  final bool saving;
  final bool enabled;
  final String? hint;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) => Material(
    elevation: 12,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (hint != null) ...[
              Text(
                hint!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
            ],
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: enabled ? onSave : null,
                icon: saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(saving ? 'Đang lưu…' : 'Lưu nháp'),
              ),
            ),
          ],
        ),
      ),
    ),
  );
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

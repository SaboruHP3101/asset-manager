import 'package:flutter/material.dart';

import '../../core/utils/display_date.dart';
import '../../core/widgets/button_spinner.dart';
import '../../core/widgets/retry_message.dart';

import 'purchase_order_models.dart';
import 'purchase_orders_repository.dart';

part 'purchase_order_form_content.dart';

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
        _restoreDraftEligibility(eligible, initial);
        for (final item in initial.items) {
          _quantities[item['purchaseRequestItemId'] as String] =
              TextEditingController(text: (item['quantity'] as int).toString());
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

  void _restoreDraftEligibility(
    List<EligiblePurchaseOrderItem> eligible,
    PurchaseOrderDetail initial,
  ) {
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
          ? RetryMessage(message: _error!, onRetry: _load, buttonSpacing: 0)
          : _eligible == null
          ? const Center(child: CircularProgressIndicator())
          : _requests.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Không có hạng mục nào còn số lượng để đặt mua.',
                  textAlign: TextAlign.center,
                ),
              ),
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
    return _OrderQuantityCard(
      item: item,
      controller: controller,
      quantity: _quantityFor(item) ?? 0,
      onChanged: () => setState(() {}),
      onSetQuantity: (quantity) => _setQuantity(item, quantity),
    );
  }

  Widget _dateField({
    required String label,
    required DateTime value,
    required VoidCallback onTap,
    String? errorText,
  }) => Semantics(
    button: true,
    label: '$label, ${formatDisplayDate(value)}',
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          errorText: errorText,
          suffixIcon: const Icon(Icons.calendar_today_outlined),
        ),
        child: Text(formatDisplayDate(value)),
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
}

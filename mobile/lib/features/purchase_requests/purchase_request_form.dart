import 'package:flutter/material.dart';

import 'purchase_request_models.dart';
import 'purchase_requests_repository.dart';

enum PurchaseRequestFormResult { saved, deleted }

class PurchaseRequestFormScreen extends StatefulWidget {
  const PurchaseRequestFormScreen({super.key, this.initial, this.repository});

  final PurchaseRequestDetail? initial;
  final PurchaseRequestsRepository? repository;

  @override
  State<PurchaseRequestFormScreen> createState() => _PurchaseRequestFormState();
}

class _PurchaseRequestFormState extends State<PurchaseRequestFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final PurchaseRequestsRepository _repository;
  late final TextEditingController _purpose;
  late final TextEditingController _note;
  late DateTime _neededBy;
  final List<_ItemControllers> _items = [];
  List<PurchaseCategoryOption> _categories = [];
  int _expanded = 0;
  bool _loading = true;
  bool _saving = false;
  bool _deleting = false;
  bool _dirty = false;
  String? _error;

  bool get _canDeleteDraft =>
      widget.initial?.status == 'draft' &&
      (widget.initial?.allows('purchase.request.delete_draft') ?? false);

  List<PurchaseCategoryOption> get _roots =>
      _categories
          .where((category) => category.parentCategoryId == null)
          .toList()
        ..sort((a, b) => a.name.compareTo(b.name));

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseRequestsRepository();
    _purpose = TextEditingController(text: widget.initial?.purpose);
    _note = TextEditingController(text: widget.initial?.note);
    _neededBy = widget.initial == null
        ? DateTime.now().add(const Duration(days: 14))
        : DateTime.parse(widget.initial!.neededByDate);
    final initialItems = widget.initial?.items;
    if (initialItems == null) {
      _items.add(_ItemControllers());
    } else {
      _items.addAll(
        initialItems.map(
          (item) => _ItemControllers(
            categoryId: item['assetCategoryId'] as String,
            name: item['itemName'] as String,
            customTypeDescription: item['customCategoryDescription'] as String?,
            specifications: item['specifications'] as String,
            quantity: '${item['quantity'] as int}',
            purpose: item['purpose'] as String?,
          ),
        ),
      );
    }
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final categories = await _repository.categories();
      for (final item in _items) {
        final selected = categories
            .where((category) => category.id == item.categoryId)
            .firstOrNull;
        item
          ..rootId = selected?.parentCategoryId
          ..requiresCustomType = selected?.allowsCustomType ?? false;
      }
      if (!mounted) return;
      setState(() {
        _categories = categories;
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

  Future<void> _save({required bool submit}) async {
    final incomplete = _items.indexWhere((item) => !item.complete);
    if (incomplete >= 0) {
      setState(() => _expanded = incomplete);
      await WidgetsBinding.instance.endOfFrame;
    }
    if (!_formKey.currentState!.validate()) return;
    if (submit && !await _review()) return;

    setState(() => _saving = true);
    try {
      final detail = await _repository.save(
        id: widget.initial?.id,
        neededByDate: _isoDate(_neededBy),
        purpose: _purpose.text.trim(),
        note: _note.text.trim(),
        items: _items
            .map(
              (item) => PurchaseRequestItemDraft(
                assetCategoryId: item.categoryId!,
                itemName: item.name.text.trim(),
                customCategoryDescription: item.requiresCustomType
                    ? item.customTypeDescription.text.trim()
                    : null,
                specifications: item.specifications.text.trim(),
                quantity: int.parse(item.quantity.text),
                purpose: item.purpose.text.trim(),
              ),
            )
            .toList(),
      );
      if (submit) await _repository.submit(detail.id);
      if (!mounted) return;
      _dirty = false;
      Navigator.pop(context, PurchaseRequestFormResult.saved);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseApiError(error))));
      setState(() => _saving = false);
    }
  }

  Future<void> _deleteDraft() async {
    final initial = widget.initial;
    if (initial == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xóa bản nháp?'),
        content: const Text(
          'Đề nghị mua này sẽ bị xóa vĩnh viễn và không thể khôi phục.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Theme.of(context).colorScheme.onError,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa bản nháp'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _deleting = true);
    try {
      await _repository.deleteDraft(initial.id);
      if (!mounted) return;
      _dirty = false;
      Navigator.pop(context, PurchaseRequestFormResult.deleted);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(purchaseApiError(error))));
      setState(() => _deleting = false);
    }
  }

  Future<bool> _review() async =>
      (await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) => _ReviewSheet(
          date: _isoDate(_neededBy),
          purpose: _purpose.text.trim(),
          items: _items,
          categoryName: _categoryName,
        ),
      )) ??
      false;

  void _addItem() => setState(() {
    _items.add(_ItemControllers());
    _expanded = _items.length - 1;
    _dirty = true;
  });

  Future<void> _removeItem(int index) async {
    final removed = _items.removeAt(index);
    var restored = false;
    setState(() {
      _dirty = true;
      _expanded = _expanded.clamp(0, _items.length - 1);
    });
    final snackbar = ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đã xóa hạng mục ${index + 1}.'),
        action: SnackBarAction(
          label: 'Hoàn tác',
          onPressed: () {
            restored = true;
            if (!mounted) return;
            setState(() {
              _items.insert(index.clamp(0, _items.length), removed);
              _expanded = index;
            });
          },
        ),
      ),
    );
    await snackbar.closed;
    if (!restored) removed.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_dirty || _saving || _deleting,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop || !await _confirmDiscard()) return;
        if (context.mounted) Navigator.pop(context);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            widget.initial == null ? 'Tạo đề nghị mua' : 'Sửa đề nghị',
          ),
          // actions: const [
          //   Padding(
          //     padding: EdgeInsets.only(right: 16),
          //     child: Chip(
          //       avatar: Icon(Icons.edit_note, size: 18),
          //       label: Text('Nháp'),
          //     ),
          //   ),
          // ],
        ),
        body: _loading
            ? const _LoadingState()
            : _error != null
            ? _MessageState(
                icon: Icons.cloud_off_outlined,
                title: _error!,
                action: _loadCategories,
              )
            : _roots.isEmpty
            ? _MessageState(
                icon: Icons.account_tree_outlined,
                title: 'Chưa có danh mục mua hàng.',
                action: _loadCategories,
              )
            : Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
                  children: [
                    _ProgressCard(
                      complete: _items.where((item) => item.complete).length,
                      total: _items.length,
                    ),
                    const SizedBox(height: 16),
                    _InformationCard(
                      date: _neededBy,
                      purpose: _purpose,
                      note: _note,
                      onPickDate: _pickDate,
                      onChanged: _changed,
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Hạng mục cần mua',
                                style: TextStyle(
                                  fontSize: 19,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text('Hoàn thiện từng hạng mục'),
                            ],
                          ),
                        ),
                        FilledButton.tonalIcon(
                          onPressed: _addItem,
                          icon: const Icon(Icons.add),
                          label: const Text('Thêm'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    for (var index = 0; index < _items.length; index++) ...[
                      _ItemCard(
                        key: ValueKey(_items[index]),
                        index: index,
                        item: _items[index],
                        expanded: index == _expanded,
                        roots: _roots,
                        children: _children(_items[index].rootId),
                        rootName: _categoryName(_items[index].rootId),
                        categoryName: _categoryName(_items[index].categoryId),
                        canRemove: _items.length > 1,
                        onExpand: () => setState(() => _expanded = index),
                        onRootChanged: (value) => setState(() {
                          _items[index]
                            ..rootId = value
                            ..categoryId = null
                            ..requiresCustomType = false;
                          _items[index].customTypeDescription.clear();
                          _dirty = true;
                        }),
                        onCategoryChanged: (value) => setState(() {
                          final selected = _categories
                              .where((category) => category.id == value)
                              .firstOrNull;
                          _items[index]
                            ..categoryId = value
                            ..requiresCustomType =
                                selected?.allowsCustomType ?? false;
                          if (!_items[index].requiresCustomType) {
                            _items[index].customTypeDescription.clear();
                          }
                          _dirty = true;
                        }),
                        onChanged: _changed,
                        onRemove: () => _removeItem(index),
                      ),
                      const SizedBox(height: 12),
                    ],
                    _SummaryCard(
                      itemCount: _items.length,
                      quantity: _items.fold(
                        0,
                        (sum, item) =>
                            sum + (int.tryParse(item.quantity.text) ?? 0),
                      ),
                      date: _isoDate(_neededBy),
                    ),
                    if (_canDeleteDraft) ...[
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: _saving || _deleting ? null : _deleteDraft,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Theme.of(context)
                                .colorScheme
                                .error,
                            side: BorderSide(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                          icon: _deleting
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.delete_outline),
                          label: Text(
                            _deleting ? 'Đang xóa bản nháp…' : 'Xóa bản nháp',
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
        bottomNavigationBar: _loading || _error != null || _roots.isEmpty
            ? null
            : _ActionBar(
                saving: _saving,
                deleting: _deleting,
                onDraft: () => _save(submit: false),
                onSubmit: () => _save(submit: true),
              ),
      ),
    );
  }

  List<PurchaseCategoryOption> _children(String? rootId) => rootId == null
      ? const []
      : (_categories
            .where((category) => category.parentCategoryId == rootId)
            .toList()
          ..sort((a, b) => a.name.compareTo(b.name)));

  String? _categoryName(String? id) =>
      _categories.where((category) => category.id == id).firstOrNull?.name;

  void _changed() => setState(() => _dirty = true);

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _neededBy,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (date != null) {
      setState(() {
        _neededBy = date;
        _dirty = true;
      });
    }
  }

  Future<bool> _confirmDiscard() async =>
      (await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Bỏ thay đổi?'),
          content: const Text('Các nội dung chưa lưu sẽ bị mất.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Tiếp tục chỉnh sửa'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Bỏ thay đổi'),
            ),
          ],
        ),
      )) ??
      false;

  @override
  void dispose() {
    _purpose.dispose();
    _note.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.complete, required this.total});
  final int complete;
  final int total;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: [
          Theme.of(context).colorScheme.primaryContainer,
          Theme.of(context).colorScheme.secondaryContainer,
        ],
      ),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Hoàn thiện đề nghị của bạn',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 5),
        Text('$complete/$total hạng mục đã đủ thông tin'),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : complete / total,
            minHeight: 7,
          ),
        ),
      ],
    ),
  );
}

class _InformationCard extends StatelessWidget {
  const _InformationCard({
    required this.date,
    required this.purpose,
    required this.note,
    required this.onPickDate,
    required this.onChanged,
  });
  final DateTime date;
  final TextEditingController purpose;
  final TextEditingController note;
  final VoidCallback onPickDate;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Title(
            icon: Icons.description_outlined,
            text: 'Thông tin đề nghị',
          ),
          const SizedBox(height: 14),
          InkWell(
            onTap: onPickDate,
            borderRadius: BorderRadius.circular(14),
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'Ngày cần tài sản',
                suffixIcon: Icon(Icons.calendar_month_outlined),
              ),
              child: Text(_displayDate(date)),
            ),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: purpose,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Mục đích sử dụng *',
              hintText: 'Ví dụ: Trang bị cho nhân viên mới',
              prefixIcon: Icon(Icons.flag_outlined),
            ),
            onChanged: (_) => onChanged(),
            validator: _required,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: note,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Ghi chú',
              prefixIcon: Icon(Icons.notes_outlined),
            ),
            onChanged: (_) => onChanged(),
          ),
        ],
      ),
    ),
  );
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({
    required this.index,
    required this.item,
    required this.expanded,
    required this.roots,
    required this.children,
    required this.rootName,
    required this.categoryName,
    required this.canRemove,
    required this.onExpand,
    required this.onRootChanged,
    required this.onCategoryChanged,
    required this.onChanged,
    required this.onRemove,
    super.key,
  });
  final int index;
  final _ItemControllers item;
  final bool expanded;
  final List<PurchaseCategoryOption> roots;
  final List<PurchaseCategoryOption> children;
  final String? rootName;
  final String? categoryName;
  final bool canRemove;
  final VoidCallback onExpand;
  final ValueChanged<String?> onRootChanged;
  final ValueChanged<String?> onCategoryChanged;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final title = item.name.text.trim().isEmpty
        ? 'Hạng mục ${index + 1}'
        : item.name.text.trim();
    final subtitle = rootName == null || categoryName == null
        ? 'Chạm để bổ sung thông tin'
        : '$rootName › $categoryName · SL ${item.quantity.text}';

    return Card(
      elevation: expanded ? 2 : 0,
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          InkWell(
            onTap: onExpand,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: item.complete
                        ? Theme.of(context).colorScheme.primaryContainer
                        : Theme.of(context).colorScheme.errorContainer,
                    child: Icon(
                      item.complete ? Icons.check : Icons.priority_high,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  if (canRemove)
                    IconButton(
                      tooltip: 'Xóa hạng mục ${index + 1}',
                      onPressed: onRemove,
                      icon: const Icon(Icons.delete_outline),
                    ),
                  AnimatedRotation(
                    turns: expanded ? .5 : 0,
                    duration: const Duration(milliseconds: 220),
                    child: const Icon(Icons.keyboard_arrow_down),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 240),
            child: expanded
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
                    child: Column(
                      children: [
                        const Divider(),
                        const SizedBox(height: 8),
                        _CategoryField(
                          label: 'Nhóm tài sản *',
                          hint: 'Chọn nhóm tài sản',
                          value: item.rootId,
                          options: roots,
                          onChanged: onRootChanged,
                        ),
                        const SizedBox(height: 14),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          child: _CategoryField(
                            key: ValueKey(item.rootId),
                            label: 'Loại tài sản *',
                            hint: item.rootId == null
                                ? 'Chọn nhóm tài sản trước'
                                : 'Chọn loại tài sản',
                            value: item.categoryId,
                            options: children,
                            enabled: item.rootId != null,
                            onChanged: onCategoryChanged,
                          ),
                        ),
                        const SizedBox(height: 14),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          child: item.requiresCustomType
                              ? TextFormField(
                                  key: const ValueKey('custom-type'),
                                  controller: item.customTypeDescription,
                                  decoration: const InputDecoration(
                                    labelText: 'Mô tả loại tài sản *',
                                    hintText:
                                        'Ví dụ: Thiết bị hội nghị truyền hình',
                                    prefixIcon: Icon(Icons.edit_outlined),
                                  ),
                                  onChanged: (_) => onChanged(),
                                  validator: _required,
                                )
                              : const SizedBox.shrink(),
                        ),
                        if (item.requiresCustomType) const SizedBox(height: 14),
                        TextFormField(
                          controller: item.name,
                          decoration: const InputDecoration(
                            labelText: 'Tên tài sản *',
                            hintText: 'Ví dụ: Apple MacBook Pro 14in M4',
                            prefixIcon: Icon(Icons.inventory_2_outlined),
                          ),
                          onChanged: (_) => onChanged(),
                          validator: _required,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: item.specifications,
                          maxLines: 2,
                          decoration: const InputDecoration(
                            labelText: 'Mô tả / thông số *',
                            hintText: 'Cấu hình, kích thước, yêu cầu kỹ thuật…',
                          ),
                          onChanged: (_) => onChanged(),
                          validator: _required,
                        ),
                        const SizedBox(height: 14),
                        _QuantityField(
                          controller: item.quantity,
                          onChanged: onChanged,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: item.purpose,
                          decoration: const InputDecoration(
                            labelText: 'Mục đích riêng (nếu có)',
                            prefixIcon: Icon(Icons.info_outline),
                          ),
                          onChanged: (_) => onChanged(),
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

class _CategoryField extends StatelessWidget {
  const _CategoryField({
    required this.label,
    required this.hint,
    required this.value,
    required this.options,
    required this.onChanged,
    this.enabled = true,
    super.key,
  });
  final String label;
  final String hint;
  final String? value;
  final List<PurchaseCategoryOption> options;
  final ValueChanged<String?> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final selected = options.where((option) => option.id == value).firstOrNull;
    return FormField<String>(
      key: ValueKey('$label-$value'),
      initialValue: value,
      validator: (value) => value == null ? 'Vui lòng chọn danh mục.' : null,
      builder: (field) => InkWell(
        onTap: enabled
            ? () async {
                final result = await _pickCategory(
                  context,
                  title: label.replaceAll(' *', ''),
                  options: options,
                  selectedId: value,
                );
                if (result == null) return;
                field.didChange(result);
                onChanged(result);
              }
            : null,
        borderRadius: BorderRadius.circular(14),
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            errorText: field.errorText,
            enabled: enabled,
            prefixIcon: const Icon(Icons.account_tree_outlined),
            suffixIcon: const Icon(Icons.keyboard_arrow_down),
          ),
          child: Text(
            selected?.name ?? hint,
            style: selected == null
                ? TextStyle(color: Theme.of(context).hintColor)
                : null,
          ),
        ),
      ),
    );
  }
}

Future<String?> _pickCategory(
  BuildContext context, {
  required String title,
  required List<PurchaseCategoryOption> options,
  required String? selectedId,
}) => showModalBottomSheet<String>(
  context: context,
  showDragHandle: true,
  builder: (context) => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (options.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: Text('Chưa có danh mục phù hợp.')),
            )
          else
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final option = options[index];
                  return ListTile(
                    leading: CircleAvatar(
                      child: Text(option.name.characters.first.toUpperCase()),
                    ),
                    title: Text(option.name),
                    selected: option.id == selectedId,
                    trailing: option.id == selectedId
                        ? const Icon(Icons.check_circle)
                        : null,
                    onTap: () => Navigator.pop(context, option.id),
                  );
                },
              ),
            ),
        ],
      ),
    ),
  ),
);

class _QuantityField extends StatelessWidget {
  const _QuantityField({required this.controller, required this.onChanged});
  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    void adjust(int delta) {
      controller.text = ((int.tryParse(controller.text) ?? 1) + delta)
          .clamp(1, 9999)
          .toString();
      onChanged();
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        IconButton.filledTonal(
          tooltip: 'Giảm số lượng',
          onPressed: () => adjust(-1),
          icon: const Icon(Icons.remove),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: TextFormField(
            controller: controller,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Số lượng *'),
            onChanged: (_) => onChanged(),
            validator: (value) => (int.tryParse(value ?? '') ?? 0) < 1
                ? 'Số lượng phải lớn hơn 0.'
                : null,
          ),
        ),
        const SizedBox(width: 10),
        IconButton.filledTonal(
          tooltip: 'Tăng số lượng',
          onPressed: () => adjust(1),
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.itemCount,
    required this.quantity,
    required this.date,
  });
  final int itemCount;
  final int quantity;
  final String date;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Title(icon: Icons.summarize_outlined, text: 'Tóm tắt'),
          const SizedBox(height: 10),
          Text('$itemCount hạng mục · Tổng số lượng $quantity'),
          Text('Ngày cần: $date'),
        ],
      ),
    ),
  );
}

class _ReviewSheet extends StatelessWidget {
  const _ReviewSheet({
    required this.date,
    required this.purpose,
    required this.items,
    required this.categoryName,
  });
  final String date;
  final String purpose;
  final List<_ItemControllers> items;
  final String? Function(String?) categoryName;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Kiểm tra trước khi gửi',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 6),
          const Text(
            'Sau khi gửi, nội dung sẽ bị khóa cho đến khi được trả về.',
          ),
          const SizedBox(height: 16),
          Text('Ngày cần: $date'),
          Text('Mục đích: $purpose'),
          const Divider(height: 28),
          for (var index = 0; index < items.length; index++)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(child: Text('${index + 1}')),
              title: Text(items[index].name.text.trim()),
              subtitle: Text(
                '${categoryName(items[index].rootId)} › '
                '${categoryName(items[index].categoryId)}'
                '${items[index].requiresCustomType ? ' · ${items[index].customTypeDescription.text.trim()}' : ''}',
              ),
              trailing: Text('×${items[index].quantity.text}'),
            ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: const Icon(Icons.send_outlined),
              label: const Text('Xác nhận gửi'),
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Quay lại chỉnh sửa'),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.saving,
    required this.deleting,
    required this.onDraft,
    required this.onSubmit,
  });
  final bool saving;
  final bool deleting;
  final VoidCallback onDraft;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) => Material(
    elevation: 12,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: saving || deleting ? null : onDraft,
                child: const Text('Lưu nháp'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: FilledButton.icon(
                onPressed: saving || deleting ? null : onSubmit,
                icon: saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.fact_check_outlined),
                label: Text(saving ? 'Đang lưu…' : 'Kiểm tra & gửi'),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Title extends StatelessWidget {
  const _Title({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 8),
      Text(
        text,
        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      ),
    ],
  );
}

class _ItemControllers {
  _ItemControllers({
    this.categoryId,
    String? name,
    String? customTypeDescription,
    String? specifications,
    String? quantity,
    String? purpose,
  }) : name = TextEditingController(text: name),
       customTypeDescription = TextEditingController(
         text: customTypeDescription,
       ),
       specifications = TextEditingController(text: specifications),
       quantity = TextEditingController(text: quantity ?? '1'),
       purpose = TextEditingController(text: purpose);
  String? rootId;
  String? categoryId;
  bool requiresCustomType = false;
  final TextEditingController name;
  final TextEditingController customTypeDescription;
  final TextEditingController specifications;
  final TextEditingController quantity;
  final TextEditingController purpose;
  bool get complete =>
      rootId != null &&
      categoryId != null &&
      (!requiresCustomType || customTypeDescription.text.trim().isNotEmpty) &&
      name.text.trim().isNotEmpty &&
      specifications.text.trim().isNotEmpty &&
      (int.tryParse(quantity.text) ?? 0) > 0;
  void dispose() {
    name.dispose();
    customTypeDescription.dispose();
    specifications.dispose();
    quantity.dispose();
    purpose.dispose();
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const LinearProgressIndicator(),
      const SizedBox(height: 16),
      for (final height in [120.0, 220.0, 120.0]) ...[
        Container(
          height: height,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        const SizedBox(height: 14),
      ],
    ],
  );
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.title,
    required this.action,
  });
  final IconData icon;
  final String title;
  final VoidCallback action;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 52),
          const SizedBox(height: 12),
          Text(title, textAlign: TextAlign.center),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: action,
            icon: const Icon(Icons.refresh),
            label: const Text('Tải lại'),
          ),
        ],
      ),
    ),
  );
}

String? _required(String? value) => value == null || value.trim().isEmpty
    ? 'Vui lòng nhập thông tin này.'
    : null;

String _isoDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

String _displayDate(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';

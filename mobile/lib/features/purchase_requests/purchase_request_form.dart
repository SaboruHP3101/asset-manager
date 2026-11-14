import 'package:flutter/material.dart';

import '../../core/theme/textarea_decoration.dart';
import '../../core/utils/display_date.dart';
import '../../core/widgets/button_spinner.dart';
import 'purchase_category_field.dart';
import 'purchase_request_models.dart';
import 'purchase_requests_repository.dart';

part 'purchase_request_form_content.dart';
part 'purchase_request_item_card.dart';

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
  String? _savedDraftId;
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
    final firstIncompleteItem = _items.indexWhere((item) => !item.complete);
    if (firstIncompleteItem >= 0) {
      setState(() => _expanded = firstIncompleteItem);
      await WidgetsBinding.instance.endOfFrame;
    }
    if (!_formKey.currentState!.validate()) return;
    if (submit && !await _review()) return;

    setState(() => _saving = true);
    try {
      final detail = await _repository.save(
        id: _savedDraftId ?? widget.initial?.id,
        neededByDate: _isoDate(_neededBy),
        purpose: _purpose.text.trim(),
        note: _note.text.trim(),
        items: [for (final item in _items) item.toDraft()],
      );
      _savedDraftId = detail.id;
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
                              ? const ButtonSpinner()
                              : const Icon(Icons.delete_outline),
                          label: Text(
                            _deleting ? 'Đang xóa bản nháp...' : 'Xóa bản nháp',
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

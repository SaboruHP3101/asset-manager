part of 'purchase_request_form.dart';

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
                        PurchaseCategoryField(
                          label: 'Nhóm tài sản *',
                          hint: 'Chọn nhóm tài sản',
                          value: item.rootId,
                          options: roots,
                          onChanged: onRootChanged,
                        ),
                        const SizedBox(height: 14),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          child: PurchaseCategoryField(
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
                          decoration: textareaDecoration(
                            context,
                            const InputDecoration(
                              labelText: 'Mô tả / thông số *',
                              hintText:
                                  'Cấu hình, kích thước, yêu cầu kỹ thuật...',
                            ),
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

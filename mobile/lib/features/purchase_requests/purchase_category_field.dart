import 'package:flutter/material.dart';

import 'purchase_request_models.dart';

/// Validates and displays a category selected from a bottom sheet.
class PurchaseCategoryField extends StatelessWidget {
  const PurchaseCategoryField({
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

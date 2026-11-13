import 'package:flutter/material.dart';

import '../../core/theme/textarea_decoration.dart';

/// Collects the repair result and total cost, or returns null on cancel.
Future<Map<String, String>?> showRepairCompletionDialog(
  BuildContext context, {
  required String previousCost,
}) {
  var cost = previousCost;
  final formKey = GlobalKey<FormState>();
  var notes = '';
  final validCost = RegExp(r'^\d{1,15}$');

  return showDialog<Map<String, String>>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Hoàn tất sửa chữa'),
      scrollable: true,
      content: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              minLines: 3,
              maxLines: 6,
              maxLength: 2000,
              onChanged: (value) => notes = value.trim(),
              validator: (_) => notes.isEmpty ? 'Nhập kết quả sửa chữa.' : null,
              decoration: textareaDecoration(
                context,
                const InputDecoration(
                  labelText: 'Kết quả sửa chữa',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              initialValue: cost,
              keyboardType: TextInputType.number,
              onChanged: (value) => cost = value.trim(),
              validator: (_) => validCost.hasMatch(cost)
                  ? null
                  : 'Nhập số nguyên từ 0, tối đa 15 chữ số.',
              decoration: const InputDecoration(
                labelText: 'Tổng chi phí sửa chữa (VND)',
                helperText: 'Nhập 0 nếu không phát sinh chi phí.',
                helperMaxLines: 2,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: () {
            if (formKey.currentState!.validate()) {
              Navigator.pop(context, {
                'resultNotes': notes,
                'actualCost': cost,
              });
            }
          },
          child: const Text('Xác nhận'),
        ),
      ],
    ),
  );
}

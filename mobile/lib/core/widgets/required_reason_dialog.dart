import 'package:flutter/material.dart';

import '../theme/textarea_decoration.dart';

/// Prompts for a nonblank reason and returns the trimmed text or null on cancel.
Future<String?> showRequiredReasonDialog(
  BuildContext context, {
  required String title,
  int maxLines = 5,
}) {
  var reason = '';

  return showDialog<String>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: Text(title),
        content: TextField(
          autofocus: true,
          minLines: 3,
          maxLines: maxLines,
          onChanged: (value) => setDialogState(() => reason = value.trim()),
          decoration: textareaDecoration(
            context,
            const InputDecoration(
              labelText: 'Lý do',
              border: OutlineInputBorder(),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: reason.isEmpty
                ? null
                : () => Navigator.pop(context, reason),
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    ),
  );
}

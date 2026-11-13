import 'package:flutter/material.dart';

import '../../core/theme/textarea_decoration.dart';

typedef RecallDisposalInput = ({
  String disposalDate,
  String disposalMethod,
  String? processingResult,
  String? recoveryValue,
});

/// Prompts for an IT warehouse replacement and returns its asset ID.
Future<String?> showRecallReplacementDialog(
  BuildContext context,
  List<Map<String, dynamic>> candidates,
) {
  String? selectedId;

  return showDialog<String>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: const Text('Chọn tài sản thay thế'),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: selectedId,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Tài sản trong kho IT',
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final asset in candidates)
                    DropdownMenuItem(
                      value: asset['id'] as String,
                      child: Text(
                        '${asset['assetCode']} · ${asset['name'] ?? asset['category']}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (value) => setDialogState(() => selectedId = value),
              ),
              const SizedBox(height: 12),
              const Text(
                'Khi duyệt, Trưởng IT xác nhận tài sản thay thế có giá trị quy đổi tương đương.',
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
            onPressed: selectedId == null
                ? null
                : () => Navigator.pop(context, selectedId),
            child: const Text('Chọn & duyệt'),
          ),
        ],
      ),
    ),
  );
}

/// Collects the disposal details, or returns null on cancel.
Future<RecallDisposalInput?> showRecallDisposalDialog(BuildContext context) {
  final now = DateTime.now();
  final date =
      '${now.year}-${now.month.toString().padLeft(2, '0')}-'
      '${now.day.toString().padLeft(2, '0')}';
  var method = '';
  var result = '';
  var recoveryValue = '';

  return showDialog<RecallDisposalInput>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: const Text('Hoàn tất báo phế'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                initialValue: date,
                readOnly: true,
                decoration: const InputDecoration(labelText: 'Ngày xử lý'),
              ),
              TextField(
                autofocus: true,
                onChanged: (value) =>
                    setDialogState(() => method = value.trim()),
                decoration: const InputDecoration(
                  labelText: 'Phương thức xử lý *',
                  hintText: 'Ví dụ: Bàn giao đơn vị xử lý rác điện tử',
                ),
              ),
              TextField(
                minLines: 2,
                maxLines: 4,
                onChanged: (value) => result = value.trim(),
                decoration: textareaDecoration(
                  context,
                  const InputDecoration(labelText: 'Kết quả / ghi chú'),
                ),
              ),
              TextField(
                keyboardType: TextInputType.number,
                onChanged: (value) => recoveryValue = value.trim(),
                decoration: const InputDecoration(
                  labelText: 'Giá trị thu hồi (tùy chọn)',
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
            onPressed: method.isEmpty
                ? null
                : () => Navigator.pop(context, (
                    disposalDate: date,
                    disposalMethod: method,
                    processingResult: result.isEmpty ? null : result,
                    recoveryValue: recoveryValue.isEmpty ? null : recoveryValue,
                  )),
            child: const Text('Hoàn tất'),
          ),
        ],
      ),
    ),
  );
}

/// Collects the upgrade result, or returns null on cancel.
Future<String?> showRecallUpgradeResultDialog(BuildContext context) {
  var result = '';

  return showDialog<String>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: const Text('Hoàn tất nâng cấp'),
        content: TextField(
          autofocus: true,
          minLines: 3,
          maxLines: 6,
          onChanged: (value) => setDialogState(() => result = value.trim()),
          decoration: textareaDecoration(
            context,
            const InputDecoration(
              labelText: 'Kết quả nâng cấp *',
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
            onPressed: result.isEmpty
                ? null
                : () => Navigator.pop(context, result),
            child: const Text('Gửi trả tài sản'),
          ),
        ],
      ),
    ),
  );
}

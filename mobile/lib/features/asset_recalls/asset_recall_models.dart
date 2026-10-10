String assetRecallStatusLabel(String status) => switch (status) {
  'draft' => 'Bản nháp',
  'pending_department_head' => 'Chờ Trưởng bộ phận',
  'pending_it_head' => 'Chờ Trưởng IT',
  'revision_required' => 'Cần chỉnh sửa',
  'pending_handover_confirmations' => 'Chờ xác nhận bàn giao',
  'completed' => 'Đã đổi tài sản',
  _ => status.replaceAll('_', ' '),
};

String recallErrorMessage(Object? data, String fallback) {
  if (data is Map<String, dynamic>) {
    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
    if (message is List && message.isNotEmpty) return message.first.toString();
  }

  return fallback;
}

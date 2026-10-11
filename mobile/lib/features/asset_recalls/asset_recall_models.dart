String assetRecallStatusLabel(String status) => switch (status) {
  'draft' => 'Bản nháp',
  'pending_department_head' => 'Chờ Trưởng bộ phận',
  'pending_it_head' => 'Chờ Trưởng IT',
  'revision_required' => 'Cần chỉnh sửa',
  'pending_handover_confirmations' => 'Chờ xác nhận bàn giao',
  'in_progress' => 'Đang xử lý báo phế',
  'ready_for_return' => 'Chờ nhận lại tài sản',
  'completed' => 'Đã hoàn tất',
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

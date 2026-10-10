import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/asset_recalls/asset_recall_models.dart';

void main() {
  test('dịch các trạng thái chính của phiếu đổi tài sản', () {
    expect(assetRecallStatusLabel('draft'), 'Bản nháp');
    expect(
      assetRecallStatusLabel('pending_department_head'),
      'Chờ Trưởng bộ phận',
    );
    expect(
      assetRecallStatusLabel('pending_handover_confirmations'),
      'Chờ xác nhận bàn giao',
    );
    expect(assetRecallStatusLabel('completed'), 'Đã đổi tài sản');
  });
}

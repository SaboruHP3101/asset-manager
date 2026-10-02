import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_requests/purchase_request_models.dart';

void main() {
  test('hiển thị nhãn lịch sử giao nhận bằng tiếng Việt', () {
    expect(
      purchaseHistoryActionLabel('purchase.receipt.record'),
      'Ghi nhận đợt giao hàng',
    );
    expect(
      purchaseHistoryActionLabel('purchase.receipt.accept_unit'),
      'Kiểm tra hàng đạt yêu cầu',
    );
    expect(
      purchaseHistoryActionLabel('purchase.receipt.reject_unit'),
      'Ghi nhận hàng không đạt',
    );
    expect(
      purchaseHistoryActionLabel('purchase.receipt.close_short'),
      'Đóng đơn do giao thiếu',
    );
  });

  test('hiển thị nhãn lịch sử cấp phát bằng tiếng Việt', () {
    const expectedLabels = {
      'purchase.allocation.create_initial': 'Tạo cấp phát tài sản',
      'purchase.allocation.reallocate': 'Phân bổ lại tài sản',
      'purchase.allocation.confirm_department':
          'Trưởng phòng xác nhận cấp phát',
      'purchase.allocation.confirm_recipient': 'Người nhận xác nhận cấp phát',
      'purchase.allocation.reject': 'Từ chối cấp phát',
      'purchase.allocation.activate': 'Kích hoạt cấp phát tài sản',
    };

    for (final entry in expectedLabels.entries) {
      expect(purchaseHistoryActionLabel(entry.key), entry.value);
    }
  });

  test('hiển thị nhãn trạng thái của giao nhận và cấp phát', () {
    const expectedLabels = {
      'issued': 'Đã phát hành',
      'pending_inspection': 'Chờ kiểm tra',
      'inspected': 'Đã kiểm tra',
      'awaiting_allocation': 'Chờ cấp phát',
      'awaiting_allocation_confirmation': 'Chờ xác nhận cấp phát',
      'pending_confirmations': 'Chờ các bên xác nhận',
      'active': 'Đang sử dụng',
    };

    for (final entry in expectedLabels.entries) {
      expect(purchaseStatusLabel(entry.key), entry.value);
    }
  });

  test('không lặp trạng thái khi lịch sử không làm thay đổi status', () {
    expect(
      purchaseHistoryStatusTransitionLabel('issued', 'issued'),
      'Đã phát hành',
    );
    expect(
      purchaseHistoryStatusTransitionLabel('pending_inspection', 'inspected'),
      'Chờ kiểm tra → Đã kiểm tra',
    );
  });
}

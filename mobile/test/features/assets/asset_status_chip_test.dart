import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/assets/asset_detail_screen.dart';
import 'package:mobile/features/assets/asset_status_chip.dart';
import 'package:mobile/features/assets/assets_screen.dart';

void main() {
  test('chuyển trạng thái kỹ thuật thành nhãn tiếng Việt', () {
    expect(assetStatusLabel('active'), 'Đang sử dụng');
    expect(assetStatusLabel('repairing'), 'Đang sửa chữa');
    expect(assetStatusLabel('awaiting_allocation'), 'Chờ cấp phát');
    expect(
      assetStatusLabel('awaiting_allocation_confirmation'),
      'Chờ xác nhận',
    );
    expect(assetStatusFilterKey('active'), 'in_use');
    expect(assetStatusFilterKey('using'), 'in_use');
    expect(assetStatusFilterKey('in_use'), 'in_use');
  });

  testWidgets('mã tài sản được render thành QR', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AssetQrCodeView(data: 'asset-qr-id')),
      ),
    );

    expect(find.bySemanticsLabel('Mã QR tài sản'), findsOneWidget);
    expect(find.text('asset-qr-id'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('card tài sản hiển thị thông tin chính trên màn hình hẹp', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AssetCard(
            asset: const {
              'id': 'asset-id',
              'name': 'Laptop doanh nghiệp cấu hình cao',
              'assetCode': 'TS-2026-001',
              'department': 'IT',
              'status': 'active',
              'imageUrl': null,
            },
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('TS-2026-001'), findsOneWidget);
    expect(find.text('Đang sử dụng'), findsOneWidget);
    expect(find.text('Phòng Công nghệ thông tin'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

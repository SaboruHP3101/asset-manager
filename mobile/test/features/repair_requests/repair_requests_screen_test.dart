import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/repair_requests/repair_progress_screen.dart';
import 'package:mobile/features/repair_requests/repair_requests_screen.dart';

void main() {
  testWidgets('điền chi phí lần trước và gửi tổng mới khi sửa lại', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    Object? submitted;
    final dio = ApiClient.instance.dio;
    final fixture = InterceptorsWrapper(onRequest: (options, handler) {
      if (options.path == '/repair-requests/test-id/complete') {
        submitted = options.data;
        handler.resolve(Response<void>(requestOptions: options));
        return;
      }

      expect(options.path, '/repair-requests/test-id');
      handler.resolve(Response<Map<String, dynamic>>(
        requestOptions: options,
        data: {
          'id': 'test-id',
          'status': submitted == null ? 'in_progress' : 'ready_for_return',
          'allowedActions': submitted == null ? ['repair.complete'] : [],
          'timeline': [
            {
              'actionType': 'completed',
              'metadata': {'actualCost': '1000000'},
            },
            {'actionType': 'rejected', 'status': 'rejected'},
          ],
        },
      ));
    });
    dio.interceptors.add(fixture);
    addTearDown(() => dio.interceptors.remove(fixture));

    await tester.pumpWidget(
      const MaterialApp(home: RepairProgressScreen(requestId: 'test-id')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hoàn tất sửa chữa'));
    await tester.pumpAndSettle();

    expect(find.text('1000000'), findsOneWidget);
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.first, 'Đã thay linh kiện');
    await tester.enterText(fields.last, '-1');
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    expect(submitted, isNull);

    await tester.enterText(fields.last, '1200000');
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(submitted, {
      'resultNotes': 'Đã thay linh kiện',
      'actualCost': '1200000',
    });
  });

  testWidgets('hiển thị trạng thái chờ nhận lại tài sản', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: Scaffold(
          body: RepairRequestCard(
            request: const {
              'assetName': 'Laptop IT',
              'assetCode': 'IT-001',
              'status': 'ready_for_return',
            },
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('Chờ nhận lại tài sản'), findsOneWidget);
  });
}

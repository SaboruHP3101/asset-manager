import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/repair_requests/repair_progress_screen.dart';
import 'package:mobile/features/repair_requests/repair_request_form.dart';
import 'package:mobile/features/repair_requests/repair_requests_screen.dart';

void main() {
  testWidgets('asset progress renders the wrapped request and timeline', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    final dio = ApiClient.instance.dio;
    final fixture = InterceptorsWrapper(
      onRequest: (options, handler) {
        expect(options.path, '/repair-requests/mine/asset/asset-id');
        handler.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            data: {
              'request': {
                'id': 'repair-id',
                'status': 'in_progress',
                'issueDescription': 'Màn hình hỏng',
              },
              'timeline': [
                {'notes': 'Đã kiểm tra tại kho'},
              ],
            },
          ),
        );
      },
    );
    dio.interceptors.add(fixture);
    addTearDown(() => dio.interceptors.remove(fixture));

    await tester.pumpWidget(
      const MaterialApp(home: RepairProgressScreen(assetId: 'asset-id')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Màn hình hỏng'), findsOneWidget);
    expect(find.text('Đã kiểm tra tại kho'), findsOneWidget);
  });

  for (final editing in [false, true]) {
    testWidgets(
      'save repair draft with the correct payload (editing: $editing)',
      (tester) async {
        FlutterSecureStorage.setMockInitialValues({});
        final dio = ApiClient.instance.dio;
        final writes = <RequestOptions>[];
        final fixture = InterceptorsWrapper(
          onRequest: (options, handler) {
            switch (options.path) {
              case '/assets/mine':
                handler.resolve(
                  Response<List<dynamic>>(
                    requestOptions: options,
                    data: [
                      {'id': 'asset-id', 'name': 'Laptop'},
                    ],
                  ),
                );
              case '/repair-requests/mine' when options.method == 'GET':
                handler.resolve(
                  Response<List<dynamic>>(requestOptions: options, data: []),
                );
              default:
                writes.add(options);
                handler.resolve(
                  Response<Map<String, dynamic>>(
                    requestOptions: options,
                    data: {'id': 'repair-id'},
                  ),
                );
            }
          },
        );
        dio.interceptors.add(fixture);
        addTearDown(() => dio.interceptors.remove(fixture));

        await tester.pumpWidget(
          MaterialApp(
            home: RepairRequestForm(
              initialAssetId: 'asset-id',
              requestId: editing ? 'repair-id' : null,
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextFormField), '  Màn hình hỏng  ');
        final save = find.text('Lưu nháp');
        await tester.ensureVisible(save);
        await tester.tap(save);
        await tester.pumpAndSettle();

        final request = writes.single;
        if (editing) {
          expect(request.method, 'PATCH');
          expect(request.path, '/repair-requests/repair-id');
          expect(request.data, {'issueDescription': 'Màn hình hỏng'});
        } else {
          expect(request.method, 'POST');
          expect(request.path, '/repair-requests/mine');
          final form = request.data as FormData;
          expect(Map.fromEntries(form.fields), {
            'assetId': 'asset-id',
            'issueDescription': 'Màn hình hỏng',
          });
        }
      },
    );
  }

  testWidgets('điền chi phí lần trước và gửi tổng mới khi sửa lại', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    Object? submitted;
    final dio = ApiClient.instance.dio;
    final fixture = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == '/repair-requests/test-id/complete') {
          submitted = options.data;
          handler.resolve(Response<void>(requestOptions: options));
          return;
        }

        expect(options.path, '/repair-requests/test-id');
        handler.resolve(
          Response<Map<String, dynamic>>(
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
          ),
        );
      },
    );
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

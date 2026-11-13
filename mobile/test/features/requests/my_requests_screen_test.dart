import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/requests/my_requests_screen.dart';
import 'package:mobile/features/requests/my_requests_repository.dart';

final _items = [
  MyRequestItem(
    id: 'repair-id',
    type: MyRequestType.repair,
    title: 'Laptop văn phòng',
    reference: 'TS-001',
    status: 'in_progress',
    updatedAt: DateTime(2026, 10, 10),
  ),
  MyRequestItem(
    id: 'upgrade-id',
    type: MyRequestType.upgrade,
    title: 'Máy tính thiết kế',
    reference: 'TS-002',
    status: 'pending_it_head',
    updatedAt: DateTime(2026, 10, 11),
  ),
  MyRequestItem(
    id: 'purchase-id',
    type: MyRequestType.purchase,
    title: 'Đề nghị mua',
    reference: 'PR-001',
    status: 'draft',
    updatedAt: DateTime(2026, 10, 9),
  ),
];

Widget _screen() => MaterialApp(
  theme: buildAppTheme(),
  home: MyRequestsScreen(
    loader: () async => MyRequestsData(
      mine: _items,
      queue: [
        MyRequestItem(
          id: 'queue-id',
          type: MyRequestType.repair,
          title: 'Laptop chờ duyệt',
          reference: 'TS-003',
          status: 'pending_department_head',
          updatedAt: DateTime(2026, 10, 11),
        ),
      ],
    ),
  ),
);

void main() {
  test(
    'maps the six endpoints to the correct request types and tabs',
    () async {
      final dio = Dio();
      addTearDown(dio.close);
      final fixtures = <String, Map<String, Object?>>{
        '/repair-requests/mine': {'id': 'my-repair', 'assetName': 'Laptop'},
        '/repair-requests/queue': {'id': 'queued-repair'},
        '/asset-recall-requests/mine': {'id': 'my-upgrade', 'type': 'upgrade'},
        '/asset-recall-requests/queue': {
          'id': 'queued-disposal',
          'type': 'disposal',
        },
        '/purchase-requests/mine': {'id': 'my-purchase', 'requestCode': 'PR-1'},
        '/purchase-requests/queue': {
          'id': 'queued-purchase',
          'requestCode': 'PR-2',
        },
      };
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) => handler.resolve(
            Response<List<dynamic>>(
              requestOptions: options,
              data: [fixtures[options.path]!],
            ),
          ),
        ),
      );

      final data = await MyRequestsRepository(dio: dio).load();

      expect(data.mine.map((item) => (item.id, item.type)), [
        ('my-repair', MyRequestType.repair),
        ('my-upgrade', MyRequestType.upgrade),
        ('my-purchase', MyRequestType.purchase),
      ]);
      expect(data.queue.map((item) => (item.id, item.type)), [
        ('queued-repair', MyRequestType.repair),
        ('queued-disposal', MyRequestType.disposal),
        ('queued-purchase', MyRequestType.purchase),
      ]);
      expect(data.mine.first.title, 'Laptop');
      expect(data.queue.last.reference, 'PR-2');
    },
  );

  testWidgets('hiển thị các loại đơn yêu cầu trong một danh sách', (
    tester,
  ) async {
    await tester.pumpWidget(_screen());
    await tester.pumpAndSettle();

    expect(find.text('Đơn yêu cầu'), findsOneWidget);
    expect(find.text('Của tôi'), findsOneWidget);
    expect(find.text('Chờ xử lý'), findsOneWidget);
    expect(find.text('Laptop văn phòng'), findsOneWidget);
    expect(find.text('Máy tính thiết kế'), findsOneWidget);
    expect(find.text('Đề nghị mua'), findsOneWidget);
    expect(find.text('Đang sửa chữa'), findsOneWidget);
  });

  testWidgets('tab chờ xử lý hiển thị queue riêng', (tester) async {
    await tester.pumpWidget(_screen());
    await tester.pumpAndSettle();

    expect(find.text('Laptop chờ duyệt'), findsNothing);
    await tester.tap(find.text('Chờ xử lý'));
    await tester.pumpAndSettle();

    expect(find.text('Laptop chờ duyệt'), findsOneWidget);
    expect(find.text('Laptop văn phòng'), findsNothing);
  });

  testWidgets('tìm kiếm và lọc theo loại yêu cầu', (tester) async {
    await tester.pumpWidget(_screen());
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'PR-001');
    await tester.pump();
    expect(find.text('Đề nghị mua'), findsOneWidget);
    expect(find.text('Laptop văn phòng'), findsNothing);

    await tester.enterText(find.byType(TextField), '');
    await tester.tap(find.text('Bộ lọc'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilterChip, 'Nâng cấp'));
    await tester.tap(find.text('Áp dụng'));
    await tester.pumpAndSettle();

    expect(find.text('Máy tính thiết kế'), findsOneWidget);
    expect(find.text('Laptop văn phòng'), findsNothing);
    expect(find.text('Đề nghị mua'), findsNothing);
  });
}

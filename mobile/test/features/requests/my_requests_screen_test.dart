import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/requests/my_requests_screen.dart';

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

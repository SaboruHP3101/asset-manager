import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/purchase_requests/purchase_request_form.dart';
import 'package:mobile/features/purchase_requests/purchase_request_models.dart';
import 'package:mobile/features/purchase_requests/purchase_requests_repository.dart';

class _FakeRepository extends PurchaseRequestsRepository {
  _FakeRepository() : super(dio: Dio());

  @override
  Future<List<PurchaseCategoryOption>> categories() async => const [
    PurchaseCategoryOption(id: 'electronics', name: 'Thiết bị điện tử & CNTT'),
    PurchaseCategoryOption(id: 'furniture', name: 'Nội thất'),
    PurchaseCategoryOption(
      id: 'laptop',
      name: 'Máy tính xách tay',
      parentCategoryId: 'electronics',
    ),
    PurchaseCategoryOption(
      id: 'monitor',
      name: 'Màn hình',
      parentCategoryId: 'electronics',
    ),
    PurchaseCategoryOption(
      id: 'chair',
      name: 'Ghế làm việc',
      parentCategoryId: 'furniture',
    ),
    PurchaseCategoryOption(
      id: 'electronics-other',
      name: 'Khác',
      parentCategoryId: 'electronics',
      allowsCustomType: true,
    ),
  ];
}

class _RetryRepository extends _FakeRepository {
  final saves = <String?>[];
  final submits = <String>[];

  @override
  Future<PurchaseRequestDetail> save({
    String? id,
    required String neededByDate,
    required String purpose,
    String? note,
    required List<PurchaseRequestItemDraft> items,
  }) async {
    saves.add(id);
    return _draft(allowedActions: []);
  }

  @override
  Future<void> submit(String id) async {
    submits.add(id);
    if (submits.length == 1) {
      throw DioException(requestOptions: RequestOptions());
    }
  }
}

PurchaseRequestDetail _draft({
  required List<String> allowedActions,
  bool includeIncompleteItem = false,
}) => PurchaseRequestDetail(
  id: 'request-id',
  status: 'draft',
  revision: 1,
  pendingAction: null,
  allowedActions: allowedActions,
  requestCode: 'PR-TEST',
  neededByDate: '2026-10-20',
  purpose: 'Trang bị làm việc',
  items: [
    const {
      'assetCategoryId': 'laptop',
      'itemName': 'MacBook Pro 14in',
      'specifications': 'RAM 16 GB',
      'quantity': 1,
      'purpose': null,
      'customCategoryDescription': null,
    },
    if (includeIncompleteItem)
      const {
        'assetCategoryId': 'monitor',
        'itemName': '',
        'specifications': '27 in',
        'quantity': 1,
      },
  ],
  timeline: const [],
);

void main() {
  testWidgets('new purchase request retries submit with the saved draft ID', (
    tester,
  ) async {
    final repository = _RetryRepository();
    await tester.pumpWidget(
      MaterialApp(home: PurchaseRequestFormScreen(repository: repository)),
    );
    await tester.pumpAndSettle();
    final list = find.byType(Scrollable).first;
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.first, 'Trang bị làm việc');
    await tester.scrollUntilVisible(
      find.text('Chọn nhóm tài sản'),
      250,
      scrollable: list,
    );
    await tester.tap(find.text('Chọn nhóm tài sản'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thiết bị điện tử & CNTT'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn loại tài sản'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Máy tính xách tay'));
    await tester.pumpAndSettle();

    final name = find.widgetWithText(TextFormField, 'Tên tài sản *');
    final specs = find.widgetWithText(TextFormField, 'Mô tả / thông số *');
    await tester.scrollUntilVisible(name, 160, scrollable: list);
    await tester.enterText(name, 'Laptop');
    await tester.scrollUntilVisible(specs, 150, scrollable: list);
    await tester.enterText(specs, 'RAM 16 GB');

    for (var attempt = 0; attempt < 2; attempt++) {
      await tester.tap(find.text('Kiểm tra & gửi'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận gửi'));
      await tester.pumpAndSettle();
    }
    expect(repository.saves, [null, 'request-id']);
    expect(repository.submits, ['request-id', 'request-id']);
  });

  testWidgets('saving expands and validates the first incomplete item', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: PurchaseRequestFormScreen(
          initial: _draft(allowedActions: [], includeIncompleteItem: true),
          repository: _FakeRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng nhập thông tin này.'), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Hạng mục 2'),
      250,
      scrollable: find.byType(Scrollable).first,
    );

    await tester.tap(find.text('Lưu nháp'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Vui lòng nhập thông tin này.'),
      150,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Vui lòng nhập thông tin này.'), findsOneWidget);
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('form cho phép thêm nhiều hạng mục', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: PurchaseRequestFormScreen(repository: _FakeRepository()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Hạng mục cần mua'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Hạng mục 1'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Thêm'));
    await tester.pump();
    await tester.scrollUntilVisible(
      find.text('Hạng mục 2'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Hạng mục 2'), findsOneWidget);
  });

  testWidgets('danh mục cấp 2 được lọc theo danh mục cấp 1', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: PurchaseRequestFormScreen(repository: _FakeRepository()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Chọn nhóm tài sản'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Chọn nhóm tài sản'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thiết bị điện tử & CNTT'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn loại tài sản'));
    await tester.pumpAndSettle();

    expect(find.text('Máy tính xách tay'), findsOneWidget);
    expect(find.text('Màn hình'), findsOneWidget);
    expect(find.text('Ghế làm việc'), findsNothing);
  });

  testWidgets('loại Khác yêu cầu người dùng mô tả', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: PurchaseRequestFormScreen(repository: _FakeRepository()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Chọn nhóm tài sản'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Nhóm tài sản *'), findsOneWidget);

    await tester.tap(find.text('Chọn nhóm tài sản'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thiết bị điện tử & CNTT'));
    await tester.pumpAndSettle();
    expect(find.text('Loại tài sản *'), findsOneWidget);
    await tester.tap(find.text('Chọn loại tài sản'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Khác'));
    await tester.pumpAndSettle();

    expect(find.text('Mô tả loại tài sản *'), findsOneWidget);
  });

  testWidgets('chỉ hiện nút xóa nháp khi API cấp quyền', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: PurchaseRequestFormScreen(
          initial: _draft(allowedActions: const []),
          repository: _FakeRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Xóa bản nháp'), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: PurchaseRequestFormScreen(
          initial: _draft(
            allowedActions: const ['purchase.request.delete_draft'],
          ),
          repository: _FakeRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Xóa bản nháp'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Xóa bản nháp'), findsOneWidget);
  });
}

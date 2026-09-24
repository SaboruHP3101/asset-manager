import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_requests/purchase_request_form.dart';
import 'package:mobile/features/purchase_requests/purchase_request_models.dart';
import 'package:mobile/features/purchase_requests/purchase_requests_repository.dart';

class _FakeRepository extends PurchaseRequestsRepository {
  _FakeRepository() : super(dio: Dio());

  @override
  Future<List<PurchaseCategoryOption>> categories() async => const [
    PurchaseCategoryOption(id: 'category-id', name: 'Laptop'),
  ];
}

void main() {
  testWidgets('form cho phép thêm nhiều hạng mục', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseRequestFormScreen(repository: _FakeRepository()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Hạng mục 1'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Thêm'));
    await tester.pump();
    await tester.scrollUntilVisible(
      find.text('Hạng mục 2'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Hạng mục 2'), findsOneWidget);
  });
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/asset_recalls/asset_recall_form.dart';
import 'package:mobile/features/asset_recalls/asset_recalls_repository.dart';

class _FakeRepository extends AssetRecallsRepository {
  _FakeRepository() : super(dio: Dio());

  String? createdReason;
  String? submittedId;

  @override
  Future<Map<String, dynamic>> create({
    required String assetId,
    required String reason,
  }) async {
    createdReason = reason;

    return {'id': 'recall-id'};
  }

  @override
  Future<Map<String, dynamic>> submit(
    String id, {
    bool resubmit = false,
  }) async {
    submittedId = id;

    return {'id': id, 'status': 'pending_department_head'};
  }
}

Widget _form(_FakeRepository repository) => MaterialApp(
  home: AssetRecallForm(
    assetId: 'asset-id',
    assetName: 'MacBook Pro',
    assetCode: 'TS001',
    assetCategory: 'Laptop',
    assetLocation: 'Tầng 2',
    repository: repository,
  ),
);

void main() {
  testWidgets('cho phép lưu draft khi lý do chưa hoàn tất', (tester) async {
    final repository = _FakeRepository();

    await tester.pumpWidget(_form(repository));
    await tester.tap(find.text('Lưu nháp'));
    await tester.pumpAndSettle();

    expect(repository.createdReason, '');
    expect(repository.submittedId, isNull);
  });

  testWidgets('validate rồi submit phiếu', (tester) async {
    final repository = _FakeRepository();

    await tester.pumpWidget(_form(repository));
    await tester.enterText(
      find.byType(TextFormField),
      'Cần đổi sang thiết bị tương đương',
    );
    await tester.tap(find.text('Kiểm tra & gửi'));
    await tester.pumpAndSettle();

    expect(find.text('Kiểm tra trước khi gửi'), findsOneWidget);
    expect(repository.submittedId, isNull);

    await tester.tap(find.text('Xác nhận gửi'));
    await tester.pumpAndSettle();

    expect(repository.createdReason, 'Cần đổi sang thiết bị tương đương');
    expect(repository.submittedId, 'recall-id');
  });

  testWidgets('hiển thị tiến trình và thông tin tài sản', (tester) async {
    final repository = _FakeRepository();
    await tester.binding.setSurfaceSize(const Size(320, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_form(repository));

    expect(find.text('Quy trình đổi tài sản'), findsOneWidget);
    expect(find.text('Trưởng bộ phận'), findsOneWidget);
    expect(find.text('Mã: TS001'), findsOneWidget);
    expect(find.text('Danh mục: Laptop'), findsOneWidget);
    expect(find.text('Thiết bị do IT quản lý'), findsOneWidget);
    expect(find.text('Có thể để trống khi lưu nháp.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

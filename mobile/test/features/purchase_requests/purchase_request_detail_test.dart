import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/purchase_requests/purchase_request_detail_screen.dart';
import 'package:mobile/features/purchase_requests/purchase_request_models.dart';
import 'package:mobile/features/purchase_requests/purchase_requests_repository.dart';

class _FakeRepository extends PurchaseRequestsRepository {
  _FakeRepository(this.detail, {this.supplierOptions = const []})
    : super(dio: Dio());

  final PurchaseRequestDetail detail;
  final List<PurchaseSupplierOption> supplierOptions;

  @override
  Future<PurchaseRequestDetail> findOne(String id) async => detail;

  @override
  Future<List<PurchaseSupplierOption>> suppliers() async => supplierOptions;
}

void main() {
  testWidgets('chi tiết chỉ hiển thị hành động API cho phép', (tester) async {
    final detail = PurchaseRequestDetail(
      id: 'request-id',
      status: 'draft',
      revision: 1,
      pendingAction: 'purchase.request.submit',
      allowedActions: const [
        'purchase.request.update',
        'purchase.request.submit',
      ],
      requestCode: 'PR-2026-TEST',
      neededByDate: '2026-10-15',
      purpose: 'Trang bị nhân viên mới',
      items: const [
        {
          'id': 'item-id',
          'assetCategoryId': 'category-id',
          'categoryName': 'Laptop',
          'itemName': 'Laptop doanh nghiệp',
          'specifications': 'RAM 16 GB',
          'quantity': 1,
          'quotes': <Map<String, dynamic>>[],
        },
      ],
      timeline: const [],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseRequestDetailScreen(
          requestId: detail.id,
          repository: _FakeRepository(detail),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chỉnh sửa'), findsOneWidget);
    expect(find.text('Gửi trình ký'), findsOneWidget);
    expect(find.text('Duyệt thương mại'), findsNothing);
    expect(find.text('Duyệt chuyên môn IT'), findsNothing);
  });

  testWidgets('phiếu đã gửi không hiển thị nút chỉnh sửa', (tester) async {
    final detail = PurchaseRequestDetail(
      id: 'request-id',
      status: 'pending_department_head',
      revision: 1,
      pendingAction: 'purchase.request.approve_department',
      allowedActions: const [],
      requestCode: 'PR-2026-LOCKED',
      neededByDate: '2026-10-15',
      purpose: 'Trang bị nhân viên mới',
      items: const [
        {
          'id': 'item-id',
          'assetCategoryId': 'category-id',
          'categoryName': 'Laptop',
          'itemName': 'Laptop doanh nghiệp',
          'specifications': 'RAM 16 GB',
          'quantity': 1,
          'quotes': <Map<String, dynamic>>[],
        },
      ],
      timeline: const [],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseRequestDetailScreen(
          requestId: detail.id,
          repository: _FakeRepository(detail),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chỉnh sửa'), findsNothing);
    expect(find.text('Gửi trình ký'), findsNothing);
  });

  testWidgets('lịch sử xử lý hiển thị label thay cho enum', (tester) async {
    final detail = PurchaseRequestDetail(
      id: 'request-id',
      status: 'pending_department_head',
      revision: 1,
      pendingAction: 'purchase.request.approve_department',
      allowedActions: const [],
      requestCode: 'PR-2026-HISTORY',
      neededByDate: '2026-10-15',
      purpose: 'Trang bị nhân viên mới',
      items: const [],
      timeline: const [
        {
          'actionType': 'purchase.request.submit',
          'previousStatus': 'draft',
          'newStatus': 'pending_department_head',
          'reason': null,
        },
      ],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseRequestDetailScreen(
          requestId: detail.id,
          repository: _FakeRepository(detail),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Gửi trình duyệt'), findsOneWidget);
    expect(find.text('Nháp → Chờ Trưởng phòng'), findsOneWidget);
    expect(find.text('purchase.request.submit'), findsNothing);
    expect(find.text('draft → pending_department_head'), findsNothing);
  });

  testWidgets('dialog báo giá không tràn ngang với tên nhà cung cấp dài', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const supplierName =
        'Công ty Cổ phần Thiết bị và Giải pháp Công nghệ Toàn Cầu';
    final detail = PurchaseRequestDetail(
      id: 'request-id',
      status: 'pending_procurement_enrichment',
      revision: 1,
      pendingAction: 'purchase.request.enrich_procurement',
      allowedActions: const ['purchase.request.enrich_procurement'],
      requestCode: 'PR-2026-QUOTE',
      neededByDate: '2026-10-15',
      purpose: 'Trang bị nhân viên mới',
      items: const [
        {
          'id': 'item-id',
          'assetCategoryId': 'category-id',
          'categoryName': 'Laptop',
          'itemName': 'Laptop doanh nghiệp',
          'specifications': 'RAM 16 GB',
          'quantity': 1,
          'quotes': <Map<String, dynamic>>[],
        },
      ],
      timeline: const [],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseRequestDetailScreen(
          requestId: detail.id,
          repository: _FakeRepository(
            detail,
            supplierOptions: const [
              PurchaseSupplierOption(id: 'supplier-id', name: supplierName),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Thêm báo giá: Laptop doanh nghiệp'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Thêm báo giá: Laptop doanh nghiệp'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text(supplierName).last);
    await tester.pumpAndSettle();

    expect(find.text('Thêm báo giá'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

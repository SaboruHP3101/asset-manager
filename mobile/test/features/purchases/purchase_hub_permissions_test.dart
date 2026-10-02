import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth/auth_session.dart';
import 'package:mobile/features/asset_allocations/asset_allocation_models.dart';
import 'package:mobile/features/asset_allocations/asset_allocations_repository.dart';
import 'package:mobile/features/purchase_orders/purchase_order_models.dart';
import 'package:mobile/features/purchase_orders/purchase_orders_repository.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipt_models.dart';
import 'package:mobile/features/purchase_receipts/purchase_receipts_repository.dart';
import 'package:mobile/features/purchase_requests/purchase_request_models.dart';
import 'package:mobile/features/purchase_requests/purchase_requests_repository.dart';
import 'package:mobile/features/purchases/purchase_hub_screen.dart';

class _RequestsRepository extends PurchaseRequestsRepository {
  _RequestsRepository() : super(dio: Dio());

  int mineCalls = 0;
  int queueCalls = 0;

  @override
  Future<List<PurchaseRequestSummary>> findMine() async {
    mineCalls += 1;
    return const [];
  }

  @override
  Future<List<PurchaseRequestSummary>> findQueue() async {
    queueCalls += 1;
    return const [];
  }
}

class _OrdersRepository extends PurchaseOrdersRepository {
  _OrdersRepository() : super(dio: Dio());

  int eligibleCalls = 0;
  int approvalCalls = 0;
  int findAllCalls = 0;

  @override
  Future<List<EligiblePurchaseOrderItem>> findEligibleRequests() async {
    eligibleCalls += 1;
    return const [];
  }

  @override
  Future<List<PurchaseOrderSummary>> findApprovalQueue() async {
    approvalCalls += 1;
    return const [];
  }

  @override
  Future<List<PurchaseOrderSummary>> findAll({String? requestId}) async {
    findAllCalls += 1;
    return const [];
  }
}

class _ReceiptsRepository extends PurchaseReceiptsRepository {
  _ReceiptsRepository() : super(dio: Dio());

  int inspectionCalls = 0;

  @override
  Future<List<PurchaseInspectionUnit>> findInspectionQueue() async {
    inspectionCalls += 1;
    return const [];
  }
}

class _AllocationsRepository extends AssetAllocationsRepository {
  _AllocationsRepository({this.tasks = const []}) : super(dio: Dio());

  final List<AssetAllocationTask> tasks;

  @override
  Future<List<AssetAllocationTask>> findQueue() async => tasks;
}

void main() {
  testWidgets('nhân viên thường chỉ thấy đề nghị của mình', (tester) async {
    final requests = _RequestsRepository();
    final orders = _OrdersRepository();
    final receipts = _ReceiptsRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseHubScreen(
          profile: const AuthenticatedProfile(
            department: 'BUSINESS',
            isDepartmentHead: false,
            allowedActions: {'purchase.request.create'},
          ),
          requestsRepository: requests,
          ordersRepository: orders,
          receiptsRepository: receipts,
          allocationsRepository: _AllocationsRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đề nghị của tôi'), findsOneWidget);
    expect(find.text('Việc cần xử lý'), findsNothing);
    expect(find.text('Đơn đặt mua'), findsNothing);
    expect(find.text('Kiểm tra hàng giao'), findsNothing);
    expect(find.text('Cấp phát tài sản'), findsNothing);
    expect(requests.mineCalls, 1);
    expect(requests.queueCalls, 0);
    expect(orders.eligibleCalls, 0);
    expect(orders.approvalCalls, 0);
    expect(orders.findAllCalls, 0);
    expect(receipts.inspectionCalls, 0);
  });

  testWidgets('nhân viên Thu mua chỉ thấy các khu vực được cấp quyền', (
    tester,
  ) async {
    final requests = _RequestsRepository();
    final orders = _OrdersRepository();
    final receipts = _ReceiptsRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseHubScreen(
          profile: const AuthenticatedProfile(
            department: 'PROCUREMENT',
            isDepartmentHead: false,
            allowedActions: {
              'purchase.request.create',
              'purchase.request.enrich_procurement',
              'purchase.order.create',
              'purchase.receipt.record',
              'purchase.receipt.inspect_procurement',
            },
          ),
          requestsRepository: requests,
          ordersRepository: orders,
          receiptsRepository: receipts,
          allocationsRepository: _AllocationsRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đề nghị của tôi'), findsOneWidget);
    expect(find.text('Việc cần xử lý'), findsOneWidget);
    expect(find.text('Đơn đặt mua'), findsOneWidget);
    expect(find.text('Kiểm tra hàng giao'), findsOneWidget);
    expect(find.text('Cấp phát tài sản'), findsNothing);
    expect(requests.queueCalls, 1);
    expect(orders.eligibleCalls, 1);
    expect(orders.approvalCalls, 0);
    expect(orders.findAllCalls, 1);
    expect(receipts.inspectionCalls, 1);
  });

  testWidgets('người nhận chỉ thấy cấp phát khi backend giao task', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PurchaseHubScreen(
          profile: const AuthenticatedProfile(
            department: 'BUSINESS',
            isDepartmentHead: false,
            allowedActions: {'purchase.allocation.confirm_recipient'},
          ),
          requestsRepository: _RequestsRepository(),
          ordersRepository: _OrdersRepository(),
          receiptsRepository: _ReceiptsRepository(),
          allocationsRepository: _AllocationsRepository(
            tasks: const [
              AssetAllocationTask(
                queueType: 'confirmation',
                assetId: 'asset-id',
                assetCode: 'ASSET-001',
                assetName: 'Laptop',
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đề nghị của tôi'), findsNothing);
    expect(find.text('Cấp phát tài sản'), findsOneWidget);
  });
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/asset_allocations/asset_allocation_models.dart';
import 'package:mobile/features/asset_allocations/asset_allocation_queue_screen.dart';
import 'package:mobile/features/asset_allocations/asset_allocations_repository.dart';

class _QueueRepository extends AssetAllocationsRepository {
  _QueueRepository(this.tasks) : super(dio: Dio());

  final List<AssetAllocationTask> tasks;
  int queueLoads = 0;
  int decisions = 0;
  bool failDecision = true;

  @override
  Future<List<AssetAllocationTask>> findQueue() async {
    queueLoads++;
    return tasks;
  }

  @override
  Future<void> decideBatch({
    required List<AssetAllocationTask> tasks,
    required bool confirmed,
    String? reason,
  }) async {
    decisions++;
    if (failDecision) throw StateError('test failure');
    expect(tasks.single.assetId, 'asset-1');
    expect(confirmed, isTrue);
  }
}

void main() {
  testWidgets(
    'confirmation keeps selection on failure and reloads once on success',
    (tester) async {
      final repository = _QueueRepository(const [
        AssetAllocationTask(
          queueType: 'confirmation',
          requestId: 'request-1',
          requestCode: 'PR-1',
          assetId: 'asset-1',
          assetCode: 'TS-001',
          assetName: 'Bàn họp',
          allocationId: 'allocation-1',
          decisionParty: 'recipient',
          totalAssets: 1,
          pendingAssets: 1,
        ),
      ]);
      await tester.pumpWidget(
        MaterialApp(home: AssetAllocationQueueScreen(repository: repository)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('PR-1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Bàn họp'));
      await tester.pumpAndSettle();

      final confirm = find.text('Xác nhận (1)');
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(confirm, findsOneWidget);
      expect(repository.queueLoads, 1);

      repository.failDecision = false;
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(repository.decisions, 2);
      expect(repository.queueLoads, 2);
      expect(find.text('PR-1'), findsOneWidget);
    },
  );

  testWidgets('shows one purchase request card for multiple allocation tasks', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final tasks = [
      const AssetAllocationTask(
        queueType: 'initial',
        requestId: 'request-1',
        requestCode: 'PR-2026-36205828',
        requestDepartmentId: 'department-1',
        assetId: 'asset-1',
        assetCode: 'TS-001',
        assetName: 'Bàn họp',
        totalAssets: 2,
        pendingAssets: 2,
      ),
      const AssetAllocationTask(
        queueType: 'initial',
        requestId: 'request-1',
        requestCode: 'PR-2026-36205828',
        requestDepartmentId: 'department-1',
        assetId: 'asset-2',
        assetCode: 'TS-002',
        assetName: 'Ghế họp',
        totalAssets: 2,
        pendingAssets: 2,
      ),
    ];

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: AssetAllocationQueueScreen(repository: _QueueRepository(tasks)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('PR-2026-36205828'), findsOneWidget);
    expect(
      find.text('0/2 tài sản đã cấp phát · 2 việc cần xử lý'),
      findsOneWidget,
    );
    expect(find.text('Bàn họp'), findsNothing);

    await tester.tap(find.text('PR-2026-36205828'));
    await tester.pumpAndSettle();

    expect(find.text('Bàn họp'), findsOneWidget);
    expect(find.text('Ghế họp'), findsOneWidget);
    expect(find.text('Chọn tất cả'), findsOneWidget);
    expect(find.text('Chờ cấp phát'), findsWidgets);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Chọn tất cả'));
    await tester.pump();

    expect(find.text('Bỏ chọn tất cả'), findsOneWidget);
    expect(find.text('Cấp phát 2 tài sản'), findsOneWidget);

    await tester.tap(find.text('Bỏ chọn tất cả'));
    await tester.pump();

    expect(find.text('Chọn tất cả'), findsOneWidget);
    expect(find.text('Cấp phát 2 tài sản'), findsNothing);
  });
}

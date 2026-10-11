import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/asset_recalls/asset_recall_requests_screen.dart';
import 'package:mobile/features/asset_recalls/asset_recalls_repository.dart';
import 'package:mobile/features/asset_recalls/asset_upgrade_requests_screen.dart';

class _FakeRepository extends AssetRecallsRepository {
  _FakeRepository() : super(dio: Dio());

  @override
  Future<List<Map<String, dynamic>>> findMine() async => [
    {
      'id': 'exchange-id',
      'type': 'exchange',
      'status': 'draft',
      'assetName': 'Laptop đổi',
      'assetCode': 'EX-01',
    },
    {
      'id': 'upgrade-id',
      'type': 'upgrade',
      'status': 'draft',
      'assetName': 'Laptop nâng cấp',
      'assetCode': 'UP-01',
    },
  ];

  @override
  Future<List<Map<String, dynamic>>> findQueue() async => [];
}

void main() {
  testWidgets('màn thu hồi chung không hiển thị phiếu nâng cấp', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AssetRecallRequestsScreen(repository: _FakeRepository()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Laptop đổi'), findsOneWidget);
    expect(find.text('Laptop nâng cấp'), findsNothing);
  });

  testWidgets('màn nâng cấp chỉ hiển thị phiếu nâng cấp', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AssetUpgradeRequestsScreen(repository: _FakeRepository()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Nâng cấp tài sản'), findsOneWidget);
    expect(find.text('Laptop nâng cấp'), findsOneWidget);
    expect(find.text('Laptop đổi'), findsNothing);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/repair_requests/repair_requests_screen.dart';

void main() {
  testWidgets('hiển thị trạng thái chờ nhận lại tài sản', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
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

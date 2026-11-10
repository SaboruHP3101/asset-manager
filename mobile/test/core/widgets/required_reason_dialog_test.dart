import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/required_reason_dialog.dart';

void main() {
  testWidgets('requires a reason, supports cancel, and trims the result', (
    tester,
  ) async {
    String? result = 'initial';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await showRequiredReasonDialog(
                  context,
                  title: 'Trả phiếu về chỉnh sửa',
                );
              },
              child: const Text('Mở'),
            ),
          ),
        ),
      ),
    );

    final open = find.text('Mở');
    final field = find.byType(TextField);
    final confirm = find.widgetWithText(FilledButton, 'Xác nhận');

    await tester.tap(open);
    await tester.pumpAndSettle();
    await tester.enterText(field, '   ');
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(confirm).onPressed, isNull);

    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(result, isNull);

    await tester.tap(open);
    await tester.pumpAndSettle();
    await tester.enterText(field, '  Thiếu thông tin  ');
    await tester.pumpAndSettle();
    await tester.tap(confirm);
    await tester.pumpAndSettle();
    expect(result, 'Thiếu thông tin');
  });
}

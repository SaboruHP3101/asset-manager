import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth/auth_session.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/home/presentation/home_screen.dart';
import 'package:mobile/features/login/login_screen.dart';

void main() {
  test('brand actions and text retain readable contrast', () {
    final colors = buildAppTheme().colorScheme;
    double contrast(Color first, Color second) {
      final light = first.computeLuminance();
      final dark = second.computeLuminance();
      return light > dark
          ? (light + 0.05) / (dark + 0.05)
          : (dark + 0.05) / (light + 0.05);
    }

    expect(
      contrast(colors.onSurface, colors.surface),
      greaterThanOrEqualTo(4.5),
    );
    expect(contrast(colors.primary, colors.surface), greaterThanOrEqualTo(4.5));
    expect(
      contrast(colors.onSecondaryContainer, colors.secondaryContainer),
      greaterThanOrEqualTo(4.5),
    );
  });

  testWidgets('login keeps its original hero and flat form layout', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(theme: buildAppTheme(), home: const LoginScreen()),
    );
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byType(Image)), const Size(390, 350));
    expect(find.byType(Card), findsNothing);
    expect(find.byIcon(Icons.inventory_2_outlined), findsNothing);
    expect(find.text('Chào mừng!'), findsOneWidget);
    expect(find.text('Tiếp theo'), findsOneWidget);
  });

  testWidgets('login remains usable with large text and the keyboard', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(1.8),
            viewInsets: const EdgeInsets.only(bottom: 220),
          ),
          child: child!,
        ),
        home: const LoginScreen(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Tiếp theo'),
      160,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Tiếp theo'));
    await tester.pumpAndSettle();
    expect(find.text('Địa chỉ email bắt buộc'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final size in [const Size(320, 640), const Size(844, 390)]) {
    testWidgets('home fits large text at $size', (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: const TextScaler.linear(1.8)),
            child: child!,
          ),
          home: HomeScreen(
            profile: const AuthenticatedProfile(
              fullName: 'Nguyễn Văn An',
              department: 'IT',
              isDepartmentHead: false,
              allowedActions: {'repair.report', 'purchase.request.create'},
            ),
            loadDashboard: () async => const HomeDashboardData(
              assignedAssets: 6,
              activeRequests: 2,
              purchaseRequestTasks: 0,
              purchaseOrderTasks: 0,
              inspectionTasks: 0,
              allocationTasks: 0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Báo hỏng'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Báo hỏng'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}

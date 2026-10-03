import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth/auth_session.dart';
import 'package:mobile/features/home/presentation/home_screen.dart';

const _dashboardWithEveryTask = HomeDashboardData(
  assignedAssets: 4,
  activeRequests: 2,
  purchaseRequestTasks: 3,
  purchaseOrderTasks: 2,
  inspectionTasks: 1,
  allocationTasks: 0,
);

Widget _home({
  required AuthenticatedProfile profile,
  HomeDashboardData dashboard = _dashboardWithEveryTask,
}) => MaterialApp(
  home: HomeScreen(
    key: ValueKey(dashboard),
    profile: profile,
    loadDashboard: () async => dashboard,
  ),
);

void main() {
  testWidgets('nhân viên thường không thấy công việc nghiệp vụ chuyên môn', (
    tester,
  ) async {
    await tester.pumpWidget(
      _home(
        profile: const AuthenticatedProfile(
          fullName: 'Nguyễn Văn An',
          department: 'ACCOUNTING',
          isDepartmentHead: false,
          allowedActions: {
            'purchase.request.create',
            'repair.report',
            'purchase.allocation.confirm_recipient',
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Xin chào, Nguyễn Văn An'), findsOneWidget);
    expect(find.text('Đề nghị mua chờ xử lý'), findsNothing);
    expect(find.text('Đơn đặt mua cần xử lý'), findsNothing);
    expect(find.text('Hàng giao cần kiểm tra'), findsNothing);
    expect(find.text('Cấp phát tài sản'), findsNothing);
    expect(find.text('Đề nghị mua'), findsOneWidget);
    expect(find.text('Báo hỏng'), findsOneWidget);
    expect(find.text('Yêu cầu điều chuyển'), findsNothing);
  });

  testWidgets('chỉ hiện hàng chờ tương ứng với allowedActions', (tester) async {
    await tester.pumpWidget(
      _home(
        profile: const AuthenticatedProfile(
          department: 'PROCUREMENT',
          isDepartmentHead: false,
          allowedActions: {
            'purchase.request.enrich_procurement',
            'purchase.order.create',
            'purchase.receipt.record',
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đề nghị mua chờ xử lý'), findsOneWidget);
    expect(find.text('Đơn đặt mua cần xử lý'), findsOneWidget);
    expect(find.text('Hàng giao cần kiểm tra'), findsNothing);
    expect(find.text('Cấp phát tài sản'), findsNothing);
    expect(find.text('Đề nghị mua'), findsNothing);
    expect(find.text('Báo hỏng'), findsNothing);
  });

  testWidgets('người nhận chỉ thấy cấp phát khi backend trả task', (
    tester,
  ) async {
    const profile = AuthenticatedProfile(
      department: 'WAREHOUSE',
      isDepartmentHead: false,
      allowedActions: {'purchase.allocation.confirm_recipient'},
    );

    await tester.pumpWidget(
      _home(
        profile: profile,
        dashboard: const HomeDashboardData(
          assignedAssets: 0,
          activeRequests: 0,
          purchaseRequestTasks: 0,
          purchaseOrderTasks: 0,
          inspectionTasks: 0,
          allocationTasks: 1,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cấp phát tài sản'), findsOneWidget);

    await tester.pumpWidget(
      _home(
        profile: profile,
        dashboard: const HomeDashboardData(
          assignedAssets: 0,
          activeRequests: 0,
          purchaseRequestTasks: 0,
          purchaseOrderTasks: 0,
          inspectionTasks: 0,
          allocationTasks: 0,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cấp phát tài sản'), findsNothing);
    expect(find.text('Bạn không có công việc cần xử lý.'), findsOneWidget);
  });
}

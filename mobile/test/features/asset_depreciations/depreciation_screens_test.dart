import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth/auth_session.dart';
import 'package:mobile/features/asset_depreciations/depreciation_models.dart';
import 'package:mobile/features/asset_depreciations/depreciation_screens.dart';
import 'package:mobile/features/asset_depreciations/depreciations_repository.dart';

AuthenticatedProfile _profile(Set<String> actions) => AuthenticatedProfile(
  department: 'ACCOUNTING',
  isDepartmentHead: actions.contains('depreciation.approve'),
  allowedActions: {'depreciation.view', ...actions},
);

Map<String, dynamic> _data({
  String status = 'draft',
  String? reason,
  String submittedBy = 'staff-id',
  String? calculatedAt = '2026-10-01T03:00:00Z',
}) => {
  'id': 'period-id',
  'month': '2026-09-01',
  'status': status,
  'submittedBy': submittedBy,
  'returnReason': reason,
  'calculatedAt': calculatedAt,
  'lines': [
    {
      'assetCode': 'TS-01',
      'name': 'Máy tính phòng kế toán',
      'originalCost': '60000000',
      'termMonths': 60,
      'openingValue': '60000000',
      'depreciationAmount': '1000000',
      'remainingValue': '59000000',
      'fromDate': '2026-09-01',
      'toDate': '2026-09-30',
    },
  ],
  'history': [
    {
      'action': 'depreciation.submitted',
      'actorName': 'Nhân viên kế toán',
      'createdAt': '2026-10-01T04:00:00Z',
      'reason': null,
    },
  ],
};

class _Repository extends DepreciationsRepository {
  _Repository(this.data) : super(dio: Dio());

  Map<String, dynamic> data;
  List<DepreciationPeriod> earlier = [];
  bool empty = false;
  bool failLoad = false;
  bool failSubmit = false;
  int loads = 0;
  int calculations = 0;
  int submits = 0;
  bool? approved;
  String? reason;
  Completer<DepreciationPeriod>? submission;

  @override
  Future<List<DepreciationPeriod>> findAll() async {
    loads++;
    if (failLoad) throw StateError('offline');
    return empty ? [] : [DepreciationPeriod.fromJson(data), ...earlier];
  }

  @override
  Future<DepreciationPeriod> findOne(String id) async =>
      DepreciationPeriod.fromJson(data);

  @override
  Future<String?> currentEmployeeId() async => 'head-id';

  @override
  Future<DepreciationPeriod> recalculate(String id) async {
    calculations++;
    data = {...data, 'calculatedAt': '2026-10-01T05:00:00Z'};
    return DepreciationPeriod.fromJson(data);
  }

  @override
  Future<DepreciationPeriod> submit(String id) async {
    submits++;
    if (failSubmit) {
      data = {...data, 'status': 'pending_approval'};
      throw DioException(
        requestOptions: RequestOptions(),
        response: Response(
          requestOptions: RequestOptions(),
          statusCode: 409,
          data: {'message': 'Kỳ đã chuyển trạng thái; tải lại.'},
        ),
      );
    }
    if (submission != null) return submission!.future;
    data = {...data, 'status': 'pending_approval', 'returnReason': null};
    return DepreciationPeriod.fromJson(data);
  }

  @override
  Future<DepreciationPeriod> decide(
    String id, {
    required bool approve,
    String? reason,
  }) async {
    approved = approve;
    this.reason = reason;
    data = {
      ...data,
      'status': approve ? 'recorded' : 'draft',
      'returnReason': reason,
    };
    return DepreciationPeriod.fromJson(data);
  }
}

Future<void> _detail(
  WidgetTester tester,
  _Repository repository,
  Set<String> actions,
) async {
  await tester.pumpWidget(
    MaterialApp(
      home: DepreciationDetailScreen(
        periodId: 'period-id',
        profile: _profile(actions),
        repository: repository,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('money and totals retain precision above JavaScript integer range', () {
    final data = _data();
    final line = (data['lines'] as List).first as Map<String, dynamic>;
    data['lines'] = [
      line,
      {...line, 'depreciationAmount': '999999999999999999'},
    ];
    final period = DepreciationPeriod.fromJson(data);
    expect(period.total, '1000000000000999999');
    expect(
      depreciationMoney('999999999999999999'),
      '999.999.999.999.999.999 ₫',
    );
    expect(period.monthLabel, '09/2026');
  });

  testWidgets('list retries, opens detail, and refreshes after returning', (
    tester,
  ) async {
    final repository = _Repository(_data())..failLoad = true;
    await tester.pumpWidget(
      MaterialApp(
        home: DepreciationPeriodsScreen(
          profile: _profile({'depreciation.prepare'}),
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Thử lại'), findsOneWidget);
    repository.failLoad = false;
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(find.text('Tháng 09/2026'), findsOneWidget);
    expect(find.text('1.000.000 ₫'), findsOneWidget);
    await tester.tap(find.text('Tháng 09/2026'));
    await tester.pumpAndSettle();
    expect(find.text('Trình duyệt'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(repository.loads, 4);
  });

  testWidgets('unauthorized route does not fetch periods', (tester) async {
    final repository = _Repository(_data());
    await tester.pumpWidget(
      MaterialApp(
        home: DepreciationPeriodsScreen(
          profile: const AuthenticatedProfile(
            department: 'IT',
            isDepartmentHead: true,
            allowedActions: {},
          ),
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(repository.loads, 0);
    expect(find.text('Bạn không có quyền xem khấu hao.'), findsOneWidget);
  });

  testWidgets('empty list explains automatic drafts and can refresh', (
    tester,
  ) async {
    final repository = _Repository(_data())..empty = true;
    await tester.pumpWidget(
      MaterialApp(
        home: DepreciationPeriodsScreen(
          profile: _profile({}),
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Chưa có kỳ khấu hao.'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, 400));
    await tester.pumpAndSettle();
    expect(repository.loads, 2);
  });

  testWidgets(
    'returned draft can recalculate and submit only after confirmation',
    (tester) async {
      final repository = _Repository(_data(reason: 'Kiểm tra số dư'));
      await _detail(tester, repository, {'depreciation.prepare'});
      expect(find.text('Cần chỉnh sửa'), findsOneWidget);
      expect(find.text('Lý do trả về: Kiểm tra số dư'), findsOneWidget);
      expect(find.text('Duyệt & ghi nhận'), findsNothing);
      await tester.tap(find.text('Tính lại'));
      await tester.pumpAndSettle();
      expect(repository.calculations, 1);
      await tester.tap(find.text('Trình duyệt'));
      await tester.pumpAndSettle();
      expect(repository.submits, 0);
      await tester.tap(find.text('Xác nhận trình duyệt'));
      await tester.pumpAndSettle();
      expect(repository.submits, 1);
      expect(find.text('Chờ duyệt'), findsOneWidget);
      expect(find.text('Tính lại'), findsNothing);
    },
  );

  testWidgets('submit stays locked and preserves content while API runs', (
    tester,
  ) async {
    final repository = _Repository(_data())
      ..submission = Completer<DepreciationPeriod>();
    await _detail(tester, repository, {'depreciation.prepare'});
    await tester.tap(find.text('Trình duyệt'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận trình duyệt'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text('Tổng khấu hao: 1.000.000 ₫'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Trình duyệt'),
          )
          .onPressed,
      isNull,
    );
    repository.submission!.complete(
      DepreciationPeriod.fromJson(_data(status: 'pending_approval')),
    );
    await tester.pumpAndSettle();
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });

  testWidgets('head approval confirms posting and becomes read only', (
    tester,
  ) async {
    final repository = _Repository(_data(status: 'pending_approval'));
    await _detail(tester, repository, {'depreciation.approve'});
    await tester.tap(find.text('Duyệt & ghi nhận'));
    await tester.pumpAndSettle();
    expect(repository.approved, isNull);
    expect(
      find.textContaining('Kỳ đã ghi nhận không thể mở lại.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Xác nhận duyệt & ghi nhận'));
    await tester.pumpAndSettle();
    expect(repository.approved, isTrue);
    expect(find.text('Đã ghi nhận'), findsOneWidget);
    expect(find.text('Trả về'), findsNothing);
  });

  testWidgets('return requires trimmed reason and restores draft', (
    tester,
  ) async {
    final repository = _Repository(_data(status: 'pending_approval'));
    await _detail(tester, repository, {'depreciation.approve'});
    await tester.tap(find.text('Trả về'));
    await tester.pumpAndSettle();
    final confirm = find.widgetWithText(FilledButton, 'Xác nhận trả về');
    expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
    await tester.enterText(find.byType(TextField), '   ');
    await tester.pump();
    expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
    expect(tester.widget<TextField>(find.byType(TextField)).maxLength, 1000);
    await tester.enterText(find.byType(TextField), '  Sửa số dư  ');
    await tester.pump();
    await tester.tap(confirm);
    await tester.pumpAndSettle();
    expect(repository.approved, isFalse);
    expect(repository.reason, 'Sửa số dư');
    expect(find.text('Lý do trả về: Sửa số dư'), findsOneWidget);
    expect(find.text('Trình duyệt'), findsNothing);
  });

  for (final scenario in [
    (
      status: 'pending_approval',
      actions: {'depreciation.prepare'},
      submitter: 'staff-id',
    ),
    (status: 'draft', actions: {'depreciation.approve'}, submitter: 'staff-id'),
    (
      status: 'recorded',
      actions: {'depreciation.prepare', 'depreciation.approve'},
      submitter: 'staff-id',
    ),
    (
      status: 'pending_approval',
      actions: {'depreciation.approve'},
      submitter: 'head-id',
    ),
    (status: 'draft', actions: <String>{}, submitter: 'staff-id'),
  ]) {
    testWidgets(
      'read-only ${scenario.status} ${scenario.actions} ${scenario.submitter}',
      (tester) async {
        await _detail(
          tester,
          _Repository(
            _data(status: scenario.status, submittedBy: scenario.submitter),
          ),
          scenario.actions,
        );
        expect(find.byType(FilledButton), findsNothing);
        expect(find.byType(OutlinedButton), findsNothing);
      },
    );
  }

  testWidgets('earlier open period blocks calculation and submit', (
    tester,
  ) async {
    final repository = _Repository(_data())
      ..earlier = [
        DepreciationPeriod.fromJson({
          ..._data(),
          'id': 'earlier',
          'month': '2026-08-01',
        }),
      ];
    await _detail(tester, repository, {'depreciation.prepare'});
    expect(find.textContaining('Cần ghi nhận kỳ 08/2026'), findsOneWidget);
    expect(
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Tính lại'),
          )
          .onPressed,
      isNull,
    );
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Trình duyệt'),
          )
          .onPressed,
      isNull,
    );
  });

  testWidgets('uncalculated period can calculate but cannot submit', (
    tester,
  ) async {
    await _detail(tester, _Repository(_data(calculatedAt: null)), {
      'depreciation.prepare',
    });
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Trình duyệt'),
          )
          .onPressed,
      isNull,
    );
    expect(
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Tính lại'),
          )
          .onPressed,
      isNotNull,
    );
  });

  testWidgets(
    'conflict displays server reason and refreshes available actions',
    (tester) async {
      final repository = _Repository(_data())..failSubmit = true;
      await _detail(tester, repository, {'depreciation.prepare'});
      await tester.tap(find.text('Trình duyệt'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận trình duyệt'));
      await tester.pumpAndSettle();
      expect(find.text('Kỳ đã chuyển trạng thái; tải lại.'), findsOneWidget);
      expect(find.text('Chờ duyệt'), findsOneWidget);
      expect(find.text('Trình duyệt'), findsNothing);
    },
  );

  testWidgets(
    'asset details and confirmation fit narrow screens with large text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 720);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final repository = _Repository(_data());
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: const TextScaler.linear(1.5)),
            child: child!,
          ),
          home: DepreciationDetailScreen(
            periodId: 'period-id',
            profile: _profile({'depreciation.prepare'}),
            repository: repository,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('TS-01 · Máy tính phòng kế toán'),
        150,
      );
      await tester.tap(find.text('TS-01 · Máy tính phòng kế toán'));
      await tester.pumpAndSettle();
      expect(find.text('Nguyên giá: 60.000.000 ₫'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Trình duyệt'));
      await tester.pumpAndSettle();
      expect(find.text('Xác nhận trình duyệt'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}

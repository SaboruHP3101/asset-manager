import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/asset_recalls/asset_recall_form.dart';
import 'package:mobile/features/assets/asset_detail_screen.dart';
import 'package:mobile/features/assets/assets_screen.dart';
import 'package:mobile/features/repair_requests/repair_request_form.dart';

class _AssetAdapter implements HttpClientAdapter {
  String owner = 'it';
  Map<String, Object?>? recall;
  Map<String, Object?>? repair;
  Completer<void>? repairGate;
  bool failAsset = false;
  final methods = <String>[];
  final assetListQueries = <Map<String, dynamic>>[];

  Map<String, Object?> get asset => {
    'id': 'asset-id',
    'name': 'Laptop văn phòng',
    'assetCode': 'TS012',
    'status': 'active',
    'managementOwner': owner,
    'activeRecall': recall,
  };

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    methods.add(options.method);
    if (options.method != 'GET') {
      throw StateError('Unexpected write in UI test');
    }
    Object? data;
    switch (options.path) {
      case '/assets/mine/asset-id':
        if (failAsset) return ResponseBody.fromString('{}', 500);
        data = asset;
      case '/repair-requests/mine/asset/asset-id':
        if (repairGate case final gate?) await gate.future;
        data = repair;
      case '/assets/mine':
        assetListQueries.add(Map.of(options.queryParameters));
        data = [
          asset,
          {
            ...asset,
            'id': 'spare-id',
            'name': 'Laptop dự phòng',
            'status': 'available',
          },
        ];
      case '/assets/mine/categories':
        data = [
          {'id': 'laptops', 'name': 'Máy tính'},
        ];
      case '/repair-requests/mine':
        data = <Object>[];
      default:
        throw StateError('Unexpected test read: ${options.path}');
    }
    return ResponseBody.fromString(
      jsonEncode(data),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Future<void> _showAsset(WidgetTester tester, {double textScale = 1}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: const AssetDetailScreen(assetId: 'asset-id'),
    ),
  );
}

void main() {
  late HttpClientAdapter originalAdapter;
  late _AssetAdapter adapter;
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    originalAdapter = ApiClient.instance.dio.httpClientAdapter;
    adapter = _AssetAdapter();
    ApiClient.instance.dio.httpClientAdapter = adapter;
  });
  tearDown(() => ApiClient.instance.dio.httpClientAdapter = originalAdapter);

  testWidgets('asset search and filters persist when returning from detail', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(theme: buildAppTheme(), home: const AssetsScreen()),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '  Laptop  ');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(adapter.assetListQueries.last, {
      'search': 'Laptop',
      'sort': 'name_asc',
    });

    await tester.tap(find.text('Bộ lọc'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tất cả danh mục'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Máy tính').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilterChip, 'Đang sử dụng'));
    await tester.tap(find.text('Tên Z–A'));
    await tester.tap(find.text('Áp dụng bộ lọc'));
    await tester.pumpAndSettle();

    final filteredQuery = {
      'search': 'Laptop',
      'sort': 'name_desc',
      'categoryId': 'laptops',
    };
    expect(adapter.assetListQueries.last, filteredQuery);
    expect(find.text('Laptop dự phòng'), findsNothing);
    await tester.tap(find.text('Laptop văn phòng'));
    await tester.pumpAndSettle();
    expect(find.byType(AssetDetailScreen), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(adapter.assetListQueries, hasLength(4));
    expect(adapter.assetListQueries.last, filteredQuery);
    expect(find.text('Laptop dự phòng'), findsNothing);
  });

  testWidgets('one floating button opens and dismisses the three actions', (
    tester,
  ) async {
    await _showAsset(tester);
    await tester.pumpAndSettle();
    expect(find.byType(FloatingActionButton), findsOneWidget);
    expect(find.text('Đổi / báo phế tài sản'), findsNothing);
    await tester.tap(find.byTooltip('Yêu cầu tài sản'));
    await tester.pumpAndSettle();
    expect(find.text('Đổi / báo phế tài sản'), findsOneWidget);
    expect(find.text('Yêu cầu nâng cấp tài sản'), findsOneWidget);
    expect(find.text('Gửi yêu cầu sửa chữa'), findsOneWidget);
    await tester.tap(find.byTooltip('Đóng thao tác'));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsNothing);
    expect(adapter.methods.every((method) => method == 'GET'), isTrue);
  });

  for (final action in [
    'Đổi / báo phế tài sản',
    'Yêu cầu nâng cấp tài sản',
    'Gửi yêu cầu sửa chữa',
  ]) {
    testWidgets('$action opens the existing form with the selected asset', (
      tester,
    ) async {
      await _showAsset(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Yêu cầu tài sản'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(action));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsNothing);
      if (action == 'Gửi yêu cầu sửa chữa') {
        expect(
          tester
              .widget<RepairRequestForm>(find.byType(RepairRequestForm))
              .initialAssetId,
          'asset-id',
        );
      } else {
        final form = tester.widget<AssetRecallForm>(
          find.byType(AssetRecallForm),
        );
        expect(form.assetId, 'asset-id');
        expect(
          form.fixedType,
          action == 'Yêu cầu nâng cấp tài sản' ? 'upgrade' : null,
        );
      }
      expect(adapter.methods.every((method) => method == 'GET'), isTrue);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('non-IT assets keep only the repair action', (tester) async {
    adapter.owner = 'procurement';
    await _showAsset(tester);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Yêu cầu tài sản'));
    await tester.pumpAndSettle();
    expect(find.text('Đổi / báo phế tài sản'), findsNothing);
    expect(find.text('Yêu cầu nâng cấp tài sản'), findsNothing);
    expect(find.text('Gửi yêu cầu sửa chữa'), findsOneWidget);
  });

  testWidgets('active repair keeps tracking and disables conflicting actions', (
    tester,
  ) async {
    adapter.repair = {
      'request': {'id': 'repair-id', 'status': 'ready_for_return'},
    };
    await _showAsset(tester);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Yêu cầu tài sản'));
    await tester.pumpAndSettle();
    for (final title in ['Đổi / báo phế tài sản', 'Yêu cầu nâng cấp tài sản']) {
      expect(
        tester.widget<ListTile>(find.widgetWithText(ListTile, title)).enabled,
        isFalse,
      );
    }
    expect(
      tester
          .widget<ListTile>(
            find.widgetWithText(ListTile, 'Xem tiến trình sửa chữa'),
          )
          .enabled,
      isTrue,
    );
  });

  for (final status in ['closed', 'cancelled']) {
    testWidgets('$status repair history does not block new asset actions', (
      tester,
    ) async {
      adapter.repair = {
        'request': {'id': 'repair-id', 'status': status},
      };
      await _showAsset(tester);
      await tester.pumpAndSettle();
      expect(find.text('Đang có yêu cầu sửa chữa'), findsNothing);

      await tester.tap(find.byTooltip('Yêu cầu tài sản'));
      await tester.pumpAndSettle();
      expect(find.text('Xem tiến trình sửa chữa'), findsNothing);
      for (final title in [
        'Đổi / báo phế tài sản',
        'Yêu cầu nâng cấp tài sản',
        'Gửi yêu cầu sửa chữa',
      ]) {
        expect(
          tester.widget<ListTile>(find.widgetWithText(ListTile, title)).enabled,
          isTrue,
        );
      }
    });
  }

  for (final type in ['exchange', 'upgrade']) {
    testWidgets('active $type request preserves viewing and repair gating', (
      tester,
    ) async {
      adapter.recall = {'id': 'recall-id', 'type': type};
      await _showAsset(tester);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Yêu cầu tài sản'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          type == 'upgrade'
              ? 'Xem phiếu nâng cấp tài sản'
              : 'Xem phiếu thu hồi tài sản',
        ),
        findsOneWidget,
      );
      expect(find.text('Yêu cầu nâng cấp tài sản'), findsNothing);
      expect(
        tester
            .widget<ListTile>(
              find.widgetWithText(ListTile, 'Gửi yêu cầu sửa chữa'),
            )
            .enabled,
        isFalse,
      );
    });
  }

  testWidgets('waits for repair status and hides actions on an asset error', (
    tester,
  ) async {
    adapter.failAsset = true;
    await _showAsset(tester);
    await tester.pumpAndSettle();
    expect(find.byType(FloatingActionButton), findsNothing);
    adapter.failAsset = false;
    adapter.repairGate = Completer<void>();
    await tester.tap(find.text('Thử lại'));
    for (var frame = 0; frame < 10; frame++) {
      await tester.pump(const Duration(milliseconds: 20));
      if (find.byType(FloatingActionButton).evaluate().isNotEmpty) break;
    }
    expect(
      tester
          .widget<FloatingActionButton>(find.byType(FloatingActionButton))
          .onPressed,
      isNull,
    );
    adapter.repairGate!.complete();
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<FloatingActionButton>(find.byType(FloatingActionButton))
          .onPressed,
      isNotNull,
    );
  });

  testWidgets('action sheet fits narrow screens with large text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await _showAsset(tester, textScale: 1.8);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Yêu cầu tài sản'));
    await tester.pumpAndSettle();
    expect(find.text('Gửi yêu cầu sửa chữa'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

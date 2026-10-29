import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:mobile/features/chat/chat_models.dart';
import 'package:mobile/features/chat/chat_asset_carousel.dart';
import 'package:mobile/features/chat/chat_screen.dart';

ChatReply reply({
  List<ChatRow> rows = const [],
  String message = 'Tìm thấy 1 bản ghi.',
  bool hasMore = false,
}) => ChatReply(
  message: message,
  source: 'Tài sản',
  scope: 'Dữ liệu của bạn',
  asOf: DateTime.utc(2026, 10, 24),
  rows: rows,
  hasMore: hasMore,
  conversationId: 'd2d41a43-56c0-4906-9e98-f74956e74f63',
);

const assetRows = [
  ChatRow(
    kind: 'asset',
    title: 'TS001',
    fields: [
      ChatField(label: 'Tên', value: 'MacBook Pro 14in'),
      ChatField(label: 'Trạng thái', value: 'Đang sử dụng'),
      ChatField(label: 'Ngày đưa vào sử dụng', value: '01/02/2026'),
    ],
  ),
  ChatRow(
    kind: 'asset',
    title: 'TS002',
    fields: [
      ChatField(label: 'Tên', value: 'Màn hình văn phòng'),
      ChatField(label: 'Trạng thái', value: 'Sẵn sàng'),
      ChatField(label: 'Ngày đưa vào sử dụng', value: '02/02/2026'),
    ],
  ),
];

void main() {
  testWidgets('shows shortcuts and keeps Gemini information accessible', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: ChatScreen(send: (_, _, _) async => reply()),
      ),
    );
    expect(find.text('Hôm nay bạn muốn tra cứu gì?'), findsOneWidget);
    expect(find.text('Tài sản của tôi'), findsOneWidget);
    expect(find.textContaining('được gửi đến Gemini'), findsNothing);
    await tester.tap(find.byTooltip('Thông tin Trợ lý AI'));
    await tester.pumpAndSettle();
    expect(find.textContaining('được gửi đến Gemini'), findsOneWidget);
    await tester.tap(find.text('Đóng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tài sản của tôi'));
    await tester.pumpAndSettle();
    expect(find.text('Hôm nay bạn muốn tra cứu gì?'), findsNothing);
    expect(find.text('Tìm thấy 1 bản ghi.'), findsOneWidget);
  });

  testWidgets('shows the input limit only nearby and supports keyboard send', (
    tester,
  ) async {
    final sent = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: ChatScreen(
          send: (message, _, _) async {
            sent.add(message);
            return reply();
          },
        ),
      ),
    );
    expect(find.textContaining('/ 2000'), findsNothing);
    await tester.enterText(find.byType(TextField), 'a' * 1800);
    await tester.pump();
    expect(find.text('1800 / 2000'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Tài sản của tôi');
    await tester.pump();
    expect(find.textContaining('/ 2000'), findsNothing);
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();
    expect(sent, ['Tài sản của tôi']);
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      isEmpty,
    );
  });

  testWidgets('supports large text with keyboard and reduced-motion loading', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final pending = Completer<ChatReply>();
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(1.8),
            viewInsets: const EdgeInsets.only(bottom: 220),
            disableAnimations: true,
          ),
          child: child!,
        ),
        home: ChatScreen(send: (_, _, _) => pending.future),
      ),
    );
    await tester.enterText(find.byType(TextField), 'Tài sản của tôi');
    await tester.pump();
    await tester.tap(find.byTooltip('Gửi câu hỏi'));
    await tester.pumpAndSettle();
    expect(find.text('Đang tra cứu…'), findsOneWidget);
    expect(tester.takeException(), isNull);
    pending.complete(reply());
    await tester.pumpAndSettle();
    expect(find.text('Đang tra cứu…'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'swipes compact asset cards and opens full details only when tapped',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(),
          home: ChatScreen(send: (_, _, _) async => reply(rows: assetRows)),
        ),
      );
      await tester.tap(find.text('Tôi đang có những tài sản nào?'));
      await tester.pumpAndSettle();
      expect(find.byType(ChatAssetCarousel), findsOneWidget);
      expect(tester.getSize(find.byType(PageView)).height, lessThan(200));
      expect(find.text('1 / 2'), findsOneWidget);
      expect(find.textContaining('Ngày đưa vào sử dụng:'), findsNothing);
      await tester.drag(find.byType(PageView), const Offset(-600, 0));
      await tester.pumpAndSettle();
      expect(find.text('2 / 2'), findsOneWidget);
      await tester.tap(find.text('Màn hình văn phòng'));
      await tester.pumpAndSettle();
      final sheet = find.byType(BottomSheet);
      final detailsTable = find.descendant(
        of: sheet,
        matching: find.byType(Table),
      );
      final label = find.descendant(
        of: sheet,
        matching: find.text('Ngày đưa vào sử dụng'),
      );
      final value = find.descendant(
        of: sheet,
        matching: find.byWidgetPredicate(
          (widget) => widget is SelectableText && widget.data == '02/02/2026',
        ),
      );
      expect(tester.widget<Table>(detailsTable).border, isNull);
      expect(tester.widget<Text>(label).style?.fontWeight, FontWeight.w600);
      expect(
        tester.widget<SelectableText>(value).style?.fontWeight,
        FontWeight.w400,
      );
      expect(tester.widget<SelectableText>(value).style?.fontSize, 16);
      expect(
        tester.getTopLeft(label).dx,
        lessThan(tester.getTopLeft(value).dx),
      );
      await tester.tap(find.byTooltip('Đóng chi tiết'));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsNothing);
      await tester.tap(find.byTooltip('Tài sản trước'));
      await tester.pumpAndSettle();
      expect(find.text('1 / 2'), findsOneWidget);
    },
  );

  testWidgets(
    'requests the next asset page in the current server conversation',
    (tester) async {
      final sent = <String>[];
      final contexts = <String?>[];
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(),
          home: ChatScreen(
            send: (message, conversation, _) async {
              sent.add(message);
              contexts.add(conversation);
              return reply(
                rows: sent.length == 1 ? assetRows : [],
                hasMore: sent.length == 1,
              );
            },
          ),
        ),
      );
      await tester.tap(find.text('Tôi đang có những tài sản nào?'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xem thêm tài sản'));
      await tester.pumpAndSettle();
      expect(sent.last, 'Xem tiếp danh sách tài sản.');
      expect(contexts.last, 'd2d41a43-56c0-4906-9e98-f74956e74f63');
      expect(find.text('Xem thêm tài sản'), findsNothing);
    },
  );

  testWidgets(
    'renders selectable bold, italic and lists without raw Markdown markers',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(),
          home: ChatScreen(
            send: (_, _, _) async => reply(
              message: 'Đã sử dụng **8 tháng và 23 ngày**.\n\n*Lưu ý: tính theo lịch.*\n\n- Ngày sử dụng: 01/02/2026\n- Mã: TS012',
            ),
          ),
        ),
      );
      await tester.tap(find.text('Tôi đang có những tài sản nào?'));
      await tester.pumpAndSettle();

      final markdown = find.byType(MarkdownBody);
      final paragraphs = tester.widgetList<SelectableText>(
        find.descendant(of: markdown, matching: find.byType(SelectableText)),
      );
      final spans = <TextSpan>[];
      for (final paragraph in paragraphs) {
        paragraph.textSpan?.visitChildren((span) {
          if (span is TextSpan) spans.add(span);
          return true;
        });
      }
      expect(
        spans.any(
          (span) =>
              span.text == '8 tháng và 23 ngày' &&
              span.style?.fontWeight == FontWeight.bold,
        ),
        isTrue,
      );
      expect(
        spans.any(
          (span) =>
              span.text == 'Lưu ý: tính theo lịch.' &&
              span.style?.fontStyle == FontStyle.italic,
        ),
        isTrue,
      );
      expect(
        find.textContaining('Ngày sử dụng: 01/02/2026', findRichText: true),
        findsWidgets,
      );
      expect(
        paragraphs
            .map((text) => text.textSpan?.toPlainText() ?? text.data ?? '')
            .join(),
        isNot(contains('**')),
      );
      expect(find.textContaining('Tra cứu lúc'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'continues a server conversation and clears its ID when starting a new one',
    (tester) async {
      final sent = <String?>[];
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(),
          home: ChatScreen(
            send: (message, previous, cancel) async {
              sent.add(previous);
              return reply(
                rows: const [
                  ChatRow(
                    title: 'A000123',
                    fields: [ChatField(label: 'Tên', value: 'Laptop')],
                  ),
                ],
              );
            },
          ),
        ),
      );
      await tester.tap(find.text('Tôi đang có những tài sản nào?'));
      await tester.pumpAndSettle();
      expect(find.text('Dữ liệu của bạn', findRichText: true), findsNothing);
      expect(find.textContaining('Dữ liệu của bạn'), findsNothing);
      expect(find.text('Tài sản'), findsNothing);
      expect(find.textContaining('Tra cứu lúc'), findsNothing);
      expect(find.text('Tên: Laptop'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Thông tin tài sản này');
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi câu hỏi'));
      await tester.pumpAndSettle();
      expect(sent.first, isNull);
      expect(sent.last, 'd2d41a43-56c0-4906-9e98-f74956e74f63');

      await tester.tap(find.byTooltip('Cuộc trò chuyện mới'));
      await tester.pumpAndSettle();
      expect(find.text('Tên: Laptop'), findsNothing);
      await tester.tap(find.text('Tôi đang có những tài sản nào?'));
      await tester.pumpAndSettle();
      expect(sent.last, isNull);
    },
  );

  testWidgets(
    'keeps the question on failure and retries without duplicating its bubble',
    (tester) async {
      var attempts = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(),
          home: ChatScreen(
            send: (message, previous, cancel) async {
              if (++attempts == 1) throw Exception('offline');
              return reply();
            },
          ),
        ),
      );
      await tester.enterText(find.byType(TextField), 'Câu hỏi cần giữ');
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi câu hỏi'));
      await tester.pumpAndSettle();
      expect(find.text('Thử lại'), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'Câu hỏi cần giữ',
      );
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(attempts, 2);
      expect(find.text('Câu hỏi cần giữ'), findsOneWidget);
      expect(find.text('Tìm thấy 1 bản ghi.'), findsOneWidget);
    },
  );

  testWidgets(
    'blocks duplicate sends and cancels the request on leaving the screen',
    (tester) async {
      final pending = Completer<ChatReply>();
      var calls = 0;
      var cancelled = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(),
          home: ChatScreen(
            send: (message, previous, cancel) {
              calls++;
              cancel.whenCancel.then((_) => cancelled = true);
              return pending.future;
            },
          ),
        ),
      );
      await tester.enterText(find.byType(TextField), 'Tra cứu');
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi câu hỏi'));
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi câu hỏi'));
      expect(calls, 1);
      expect(find.text('Đang tra cứu…'), findsOneWidget);
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      await tester.pump();
      expect(cancelled, true);
      pending.complete(reply());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('supports narrow screens and large text without overflow', (
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
          data: MediaQuery.of(context)
              .copyWith(textScaler: const TextScaler.linear(1.8)),
          child: child!,
        ),
        home: ChatScreen(
          send: (message, previous, cancel) async => reply(
            rows: assetRows,
            message:
                '**Tài sản TS012**\n\n*Đã sử dụng 8 tháng và 23 ngày.*\n\n'
                '- Theo ngày đưa vào sử dụng\n- Dữ liệu hiện có\n\n'
                '| Mã | Tài sản |\n| --- | --- |\n| TS012 | MacBook Pro 14in |',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.enterText(find.byType(TextField), 'Tài sản của tôi');
    await tester.pump();
    await tester.tap(find.byTooltip('Gửi câu hỏi'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    final detailsAction = find.descendant(
      of: find.byType(ChatAssetCarousel),
      matching: find.text('Xem chi tiết'),
    );
    await tester.tap(detailsAction.first);
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

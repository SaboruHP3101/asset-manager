import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../core/config/app_config.dart';
import 'chat_asset_carousel.dart';
import 'chat_models.dart';
import 'chat_repository.dart';
import 'chat_widgets.dart';

typedef ChatSender = Future<ChatReply> Function(
  String message,
  String? conversationId,
  CancelToken cancelToken,
);

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, this.send});

  final ChatSender? send;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatTurn {
  _ChatTurn(this.question);

  final String question;
  ChatReply? reply;
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _turns = <_ChatTurn>[];
  late final ChatSender _send = widget.send ?? ChatRepository().ask;
  CancelToken? _cancelToken;
  String? _error;
  String? _conversationId;
  bool _busy = false;

  @override
  void dispose() {
    _cancelToken?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _submit(String message, {bool retry = false}) async {
    final question = message.trim();
    if (_busy || question.isEmpty || question.length > 2000) return;
    final turn = retry ? _turns.last : _ChatTurn(question);
    final cancelToken = CancelToken();
    _cancelToken = cancelToken;
    setState(() {
      if (!retry) _turns.add(turn);
      _busy = true;
      _error = null;
      _input.clear();
    });
    _scrollToEnd();
    try {
      final reply = await _send(question, _conversationId, cancelToken);
      if (!mounted) return;
      setState(() {
        turn.reply = reply;
        _conversationId = reply.conversationId;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = chatError(error);
        if (_input.text.isEmpty) _input.text = question;
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        _scrollToEnd();
      }
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scroll.hasClients) {
        if (MediaQuery.disableAnimationsOf(context)) {
          _scroll.jumpTo(0);
        } else {
          _scroll.animateTo(
            0,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      }
    });
  }

  void _showInformation(BuildContext context) => showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Về Trợ lý AI'),
      content: const SingleChildScrollView(
        child: Text(
          'Chỉ tra cứu dữ liệu trong phạm vi quyền của bạn. '
          'Câu hỏi và kết quả tra cứu cần thiết được gửi đến Gemini '
          'để trả lời theo ngữ cảnh hội thoại.',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Đóng'),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Trợ lý AI'),
      actions: [
        IconButton(
          tooltip: 'Thông tin Trợ lý AI',
          onPressed: () => _showInformation(context),
          icon: const Icon(Icons.info_outline_rounded),
        ),
        IconButton(
          tooltip: 'Cuộc trò chuyện mới',
          onPressed: _busy || _turns.isEmpty
              ? null
              : () => setState(() {
                  _turns.clear();
                  _input.clear();
                  _error = null;
                  _conversationId = null;
                }),
          icon: const Icon(Icons.add_comment_outlined),
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 840),
          child: Column(
            children: [
              Expanded(
                child: ListView.builder(
                  controller: _scroll,
                  reverse: _turns.isNotEmpty,
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                  itemCount: _turns.isEmpty ? 1 : _turns.length + 1,
                  itemBuilder: (context, itemIndex) {
                    if (_turns.isEmpty) return ChatWelcome(onSubmit: _submit);
                    final index = _turns.length - itemIndex;
                    if (index == _turns.length) return _status(context);
                    final turn = _turns[index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          LayoutBuilder(
                            builder: (context, constraints) => Align(
                              alignment: Alignment.centerRight,
                              child: Container(
                                constraints: BoxConstraints(
                                  maxWidth: constraints.maxWidth * 0.88,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .primaryContainer,
                                  borderRadius: const BorderRadius.only(
                                    topLeft: Radius.circular(22),
                                    topRight: Radius.circular(22),
                                    bottomLeft: Radius.circular(22),
                                    bottomRight: Radius.circular(6),
                                  ),
                                ),
                                child: SelectableText(
                                  turn.question,
                                  style: Theme.of(context).textTheme.bodyLarge
                                      ?.copyWith(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onPrimaryContainer,
                                        height: 1.5,
                                      ),
                                ),
                              ),
                            ),
                          ),
                          if (turn.reply case final reply?) ...[
                            const SizedBox(height: 20),
                            const ChatAssistantHeader(),
                            const SizedBox(height: 12),
                            _ReplyView(
                              reply: reply,
                              onMore: !_busy && index == _turns.length - 1
                                  ? () => _submit('Xem tiếp danh sách tài sản.')
                                  : null,
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
              ),
              ChatComposer(controller: _input, busy: _busy, onSubmit: _submit),
            ],
          ),
        ),
      ),
    ),
  );

  Widget _status(BuildContext context) {
    if (_busy) return const ChatPendingReply();
    if (_error == null) return const SizedBox.shrink();
    final colors = Theme.of(context).colorScheme;

    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.errorContainer,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.error_outline, color: colors.onErrorContainer),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _error!,
                    style: TextStyle(color: colors.onErrorContainer),
                  ),
                ),
              ],
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                style: TextButton.styleFrom(
                  foregroundColor: colors.onErrorContainer,
                ),
                onPressed: () => _submit(_turns.last.question, retry: true),
                child: const Text('Thử lại'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReplyView extends StatelessWidget {
  const _ReplyView({required this.reply, this.onMore});

  final ChatReply reply;
  final VoidCallback? onMore;

  Widget _assetDetails(BuildContext context, ChatRow row) {
    final textStyle = Theme.of(context).textTheme.bodyLarge
        ?.copyWith(fontSize: 16);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(row.title, style: Theme.of(context).textTheme.titleLarge),
        ),
        if (row.imageUrl case final imageUrl?)
          if (imageUrl.startsWith('/uploads/'))
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Image.network(
                AppConfig.absoluteUrl(imageUrl),
                height: 140,
                fit: BoxFit.contain,
                semanticLabel: 'Hình ảnh ${row.title}',
                errorBuilder: (_, _, _) =>
                    const Text('Không tải được hình ảnh.'),
              ),
            ),
        Table(
          columnWidths: const {0: FlexColumnWidth(2), 1: FlexColumnWidth(3)},
          defaultVerticalAlignment: TableCellVerticalAlignment.top,
          children: [
            for (final field in row.fields)
              TableRow(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(0, 8, 16, 8),
                    child: Text(
                      field.label,
                      style: textStyle?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: SelectableText(
                      field.value,
                      style: textStyle?.copyWith(fontWeight: FontWeight.w400),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ],
    );
  }

  Widget _recordCard(BuildContext context, ChatRow row) => Card(
    margin: const EdgeInsets.only(top: 10),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(row.title, style: Theme.of(context).textTheme.titleSmall),
          if (row.imageUrl case final imageUrl?)
            if (imageUrl.startsWith('/uploads/'))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Image.network(
                  AppConfig.absoluteUrl(imageUrl),
                  height: 140,
                  fit: BoxFit.contain,
                  semanticLabel: 'Hình ảnh ${row.title}',
                  errorBuilder: (_, _, _) =>
                      const Text('Không tải được hình ảnh.'),
                ),
              ),
          for (final field in row.fields)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: SelectableText('${field.label}: ${field.value}'),
            ),
        ],
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final assetRows = reply.rows.where((row) => row.kind == 'asset').toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MarkdownBody(
          data: reply.message,
          selectable: true,
          fitContent: false,
          styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
            p: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.6),
          ),
          imageBuilder: (_, title, alt) => Text(alt ?? title ?? ''),
        ),
        if (assetRows.isNotEmpty)
          ChatAssetCarousel(
            rows: assetRows,
            onOpen: (row) => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              useSafeArea: true,
              showDragHandle: true,
              builder: (context) => SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: IconButton(
                        tooltip: 'Đóng chi tiết',
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close),
                      ),
                    ),
                    _assetDetails(context, row),
                  ],
                ),
              ),
            ),
            onMore: reply.hasMore ? onMore : null,
          ),
        for (final row in reply.rows.where((row) => row.kind != 'asset'))
          _recordCard(context, row),
        if (reply.hasMore && assetRows.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'Còn kết quả khác. Hãy hỏi “xem tiếp” hoặc thêm bộ lọc.',
            ),
          ),
        if (reply.csv case final csv?)
          OutlinedButton.icon(
            icon: const Icon(Icons.copy_outlined),
            label: const Text('Sao chép CSV'),
            onPressed: () async {
              String message;
              try {
                await Clipboard.setData(ClipboardData(text: csv));
                message = 'Đã sao chép báo cáo CSV.';
              } on PlatformException {
                message = 'Không thể sao chép báo cáo. Vui lòng thử lại.';
              }
              if (context.mounted) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text(message)));
              }
            },
          ),
      ],
    );
  }
}

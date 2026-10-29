import 'package:flutter/material.dart';

import 'chat_models.dart';

class ChatAssetCarousel extends StatefulWidget {
  const ChatAssetCarousel({
    super.key,
    required this.rows,
    required this.onOpen,
    this.onMore,
  });

  final List<ChatRow> rows;
  final ValueChanged<ChatRow> onOpen;
  final VoidCallback? onMore;

  @override
  State<ChatAssetCarousel> createState() => _ChatAssetCarouselState();
}

class _ChatAssetCarouselState extends State<ChatAssetCarousel> {
  final _controller = PageController(viewportFraction: 0.92);
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _move(int page) => _controller.animateToPage(
    page,
    duration: const Duration(milliseconds: 200),
    curve: Curves.easeOut,
  );

  @override
  Widget build(BuildContext context) {
    final textScaler = MediaQuery.textScalerOf(context);
    final theme = Theme.of(context);
    final titleStyle = theme.textTheme.titleMedium?.copyWith(fontSize: 17);
    final codeStyle = theme.textTheme.bodySmall?.copyWith(fontSize: 14);
    final statusStyle = theme.textTheme.bodyMedium?.copyWith(fontSize: 15);
    final detailStyle = theme.textTheme.labelLarge?.copyWith(
      color: theme.colorScheme.primary,
    );
    double lineHeight(TextStyle? style) =>
        textScaler.scale(style?.fontSize ?? 14) * (style?.height ?? 1.2);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height:
              52 +
              lineHeight(titleStyle) * 2 +
              lineHeight(codeStyle) +
              lineHeight(statusStyle) +
              lineHeight(detailStyle) * 2,
          child: PageView.builder(
            controller: _controller,
            padEnds: false,
            allowImplicitScrolling: true,
            itemCount: widget.rows.length,
            onPageChanged: (index) => setState(() => _index = index),
            itemBuilder: (context, index) {
              final row = widget.rows[index];
              final name =
                  row.fields
                      .where((field) => field.label == 'Tên')
                      .firstOrNull
                      ?.value ??
                  row.title;
              final status = row.fields
                  .where((field) => field.label == 'Trạng thái')
                  .firstOrNull
                  ?.value;

              return Card(
                margin: const EdgeInsets.fromLTRB(0, 8, 10, 0),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                elevation: 0,
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => widget.onOpen(row),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.devices_outlined,
                              size: 20,
                              color: theme.colorScheme.primary,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                name,
                                style: titleStyle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          row.title,
                          style: codeStyle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (status != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            status,
                            style: statusStyle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          'Xem chi tiết',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: detailStyle,
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              tooltip: 'Tài sản trước',
              onPressed: _index > 0 ? () => _move(_index - 1) : null,
              icon: const Icon(Icons.chevron_left),
            ),
            Semantics(
              liveRegion: true,
              label: 'Tài sản ${_index + 1} trên ${widget.rows.length}',
              child: Text('${_index + 1} / ${widget.rows.length}'),
            ),
            IconButton(
              tooltip: 'Tài sản tiếp theo',
              onPressed: _index < widget.rows.length - 1
                  ? () => _move(_index + 1)
                  : null,
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        if (widget.onMore != null)
          TextButton(
            onPressed: widget.onMore,
            child: const Text('Xem thêm tài sản'),
          ),
      ],
    );
  }
}

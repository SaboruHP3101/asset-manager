import 'package:flutter/material.dart';

class ChatWelcome extends StatelessWidget {
  const ChatWelcome({super.key, required this.onSubmit});

  final ValueChanged<String> onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const suggestions = [
      (
        Icons.devices_outlined,
        'Tài sản của tôi',
        'Tôi đang có những tài sản nào?',
      ),
      (
        Icons.shopping_bag_outlined,
        'Yêu cầu mua sắm',
        'Yêu cầu mua sắm của tôi đang ở trạng thái nào?',
      ),
      (Icons.verified_user_outlined, 'Quyền của tôi', 'Tôi có những quyền gì?'),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: theme.colorScheme.secondaryContainer,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Icon(
              Icons.auto_awesome_outlined,
              size: 32,
              color: theme.colorScheme.onSecondaryContainer,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Hôm nay bạn muốn tra cứu gì?',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Tìm tài sản, theo dõi yêu cầu và hỏi tiếp theo ngữ cảnh.',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          for (final (icon, title, question) in suggestions)
            Card(
              margin: const EdgeInsets.only(bottom: 10),
              elevation: 0,
              color: theme.colorScheme.surface,
              shape: RoundedRectangleBorder(
                side: BorderSide(color: theme.colorScheme.outlineVariant),
                borderRadius: BorderRadius.circular(20),
              ),
              clipBehavior: Clip.antiAlias,
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                leading: Icon(icon),
                title: Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(question),
                onTap: () => onSubmit(question),
              ),
            ),
        ],
      ),
    );
  }
}

class ChatComposer extends StatelessWidget {
  const ChatComposer({
    super.key,
    required this.controller,
    required this.busy,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool busy;
  final ValueChanged<String> onSubmit;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border.all(color: colors.outlineVariant),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 6, 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Semantics(
                  label: 'Câu hỏi',
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 3,
                    maxLength: 2000,
                    textInputAction: TextInputAction.send,
                    onSubmitted: busy ? null : onSubmit,
                    buildCounter:
                        (
                          context, {
                          required currentLength,
                          required isFocused,
                          required maxLength,
                        }) => currentLength >= 1800
                        ? Text('$currentLength / $maxLength')
                        : null,
                    decoration: const InputDecoration(
                      hintText: 'Hỏi về tài sản, yêu cầu…',
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: false,
                      contentPadding: EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: ValueListenableBuilder<TextEditingValue>(
                  valueListenable: controller,
                  builder: (context, value, child) => IconButton.filled(
                    tooltip: 'Gửi câu hỏi',
                    style: IconButton.styleFrom(
                      backgroundColor: colors.secondaryContainer,
                      foregroundColor: colors.onSecondaryContainer,
                    ),
                    onPressed: busy || value.text.trim().isEmpty
                        ? null
                        : () => onSubmit(value.text),
                    icon: const Icon(Icons.arrow_upward_rounded),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ChatAssistantHeader extends StatelessWidget {
  const ChatAssistantHeader({super.key});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      CircleAvatar(
        radius: 14,
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        child: Icon(
          Icons.auto_awesome_outlined,
          size: 16,
          color: Theme.of(context).colorScheme.onPrimaryContainer,
        ),
      ),
      const SizedBox(width: 8),
      Text(
        'Trợ lý AI',
        style: Theme.of(context).textTheme.labelLarge
            ?.copyWith(fontWeight: FontWeight.w600),
      ),
    ],
  );
}

class ChatPendingReply extends StatefulWidget {
  const ChatPendingReply({super.key});

  @override
  State<ChatPendingReply> createState() => _ChatPendingReplyState();
}

class _ChatPendingReplyState extends State<ChatPendingReply>
    with SingleTickerProviderStateMixin {
  late final _animation = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _animation.stop();
    } else {
      _animation.repeat();
    }
  }

  @override
  void dispose() {
    _animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const ChatAssistantHeader(),
        const SizedBox(height: 12),
        Row(
          children: [
            ExcludeSemantics(
              child: AnimatedBuilder(
                animation: _animation,
                builder: (context, child) => Row(
                  children: [
                    for (var index = 0; index < 3; index++)
                      Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: Opacity(
                          opacity: (_animation.value * 3).floor() == index
                              ? 1
                              : 0.25,
                          child: Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.onSurface,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Flexible(child: Text('Đang tra cứu…')),
          ],
        ),
      ],
    ),
  );
}

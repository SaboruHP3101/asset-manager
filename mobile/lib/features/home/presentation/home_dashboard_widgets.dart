import 'package:flutter/material.dart';

class HomeWelcomeHeader extends StatelessWidget {
  const HomeWelcomeHeader({
    required this.fullName,
    required this.subtitle,
    super.key,
  });

  final String fullName;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Semantics(
    header: true,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.secondaryContainer,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Icon(
            Icons.waving_hand_outlined,
            color: Theme.of(context).colorScheme.onSecondaryContainer,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          fullName.isEmpty ? 'Xin chào!' : 'Xin chào, $fullName',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 5),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    ),
  );
}

class HomeSectionTitle extends StatelessWidget {
  const HomeSectionTitle({required this.title, super.key});

  final String title;

  @override
  Widget build(BuildContext context) => Text(
    title,
    style: Theme.of(context).textTheme.titleLarge
        ?.copyWith(fontWeight: FontWeight.w700),
  );
}

class HomeTask {
  const HomeTask({
    required this.title,
    required this.subtitle,
    required this.count,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final int count;
  final IconData icon;
  final VoidCallback onTap;
}

class HomeTaskCard extends StatelessWidget {
  const HomeTaskCard({required this.task, super.key});

  final HomeTask task;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    elevation: 0,
    clipBehavior: Clip.antiAlias,
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: CircleAvatar(child: Icon(task.icon)),
      title: Text(task.title),
      subtitle: Text(task.subtitle),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Badge(label: Text('${task.count}')),
          const SizedBox(width: 6),
          const Icon(Icons.chevron_right),
        ],
      ),
      onTap: task.onTap,
    ),
  );
}

class HomeEmptyTasks extends StatelessWidget {
  const HomeEmptyTasks({super.key});

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    elevation: 0,
    child: const Padding(
      padding: EdgeInsets.all(16),
      child: Row(
        children: [
          Icon(Icons.check_circle_outline),
          SizedBox(width: 12),
          Expanded(child: Text('Bạn không có công việc cần xử lý.')),
        ],
      ),
    ),
  );
}

class HomeQuickAction {
  const HomeQuickAction({
    required this.title,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final VoidCallback onTap;
}

class HomeQuickActionGrid extends StatelessWidget {
  const HomeQuickActionGrid({required this.actions, super.key});

  final List<HomeQuickAction> actions;

  @override
  Widget build(BuildContext context) => GridView.builder(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    itemCount: actions.length,
    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      mainAxisExtent:
          61 +
          MediaQuery.textScalerOf(
                context,
              ).scale(Theme.of(context).textTheme.titleSmall?.fontSize ?? 14) *
              (Theme.of(context).textTheme.titleSmall?.height ?? 1.43) *
              2,
    ),
    itemBuilder: (context, index) {
      final action = actions[index];

      return Card(
        margin: EdgeInsets.zero,
        elevation: 0,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: action.onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(action.icon, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 9),
                Text(
                  action.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class HomeErrorCard extends StatelessWidget {
  const HomeErrorCard({
    required this.message,
    required this.onRetry,
    super.key,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined),
          const SizedBox(width: 12),
          Expanded(child: Text(message)),
          TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

class HomeSummarySkeleton extends StatelessWidget {
  const HomeSummarySkeleton({super.key});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (var index = 0; index < 2; index++) ...[
        if (index > 0) const SizedBox(width: 10),
        const Expanded(child: _SkeletonBlock(height: 118)),
      ],
    ],
  );
}

class HomeTaskSkeleton extends StatelessWidget {
  const HomeTaskSkeleton({super.key});

  @override
  Widget build(BuildContext context) => const Column(
    children: [
      _SkeletonBlock(height: 76),
      SizedBox(height: 10),
      _SkeletonBlock(height: 76),
    ],
  );
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
    ),
  );
}

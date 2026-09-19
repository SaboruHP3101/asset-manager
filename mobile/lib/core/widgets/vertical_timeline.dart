import 'package:flutter/material.dart';

enum TimelineStepState { completed, current, upcoming, rejected }

/// Dữ liệu độc lập với nghiệp vụ để timeline có thể dùng lại cho các flow khác.
class TimelineStep {
  const TimelineStep({
    required this.title,
    this.subtitle,
    this.time,
    this.state = TimelineStepState.completed,
  });

  final String title;
  final String? subtitle;
  final String? time;
  final TimelineStepState state;
}

/// Timeline dọc dùng chung cho sửa chữa, mua sắm và điều chuyển sau này.
class VerticalTimeline extends StatelessWidget {
  const VerticalTimeline({required this.steps, super.key});

  final List<TimelineStep> steps;

  Color _color(BuildContext context, TimelineStepState state) {
    return switch (state) {
      TimelineStepState.completed => Colors.green,
      TimelineStepState.current => Theme.of(context).colorScheme.primary,
      TimelineStepState.upcoming => Colors.grey.shade400,
      TimelineStepState.rejected => Theme.of(context).colorScheme.error,
    };
  }

  IconData _icon(TimelineStepState state) {
    return switch (state) {
      TimelineStepState.completed => Icons.check,
      TimelineStepState.current => Icons.more_horiz,
      TimelineStepState.upcoming => Icons.circle_outlined,
      TimelineStepState.rejected => Icons.close,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(steps.length, (index) {
        final step = steps[index];
        final color = _color(context, step.state);
        final isLast = index == steps.length - 1;

        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 40,
                child: Column(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        _icon(step.state),
                        size: 17,
                        color: Colors.white,
                      ),
                    ),
                    if (!isLast)
                      Expanded(
                        child: Container(
                          width: 2,
                          color: color.withValues(alpha: 0.4),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        step.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (step.subtitle?.isNotEmpty == true) ...[
                        const SizedBox(height: 4),
                        Text(
                          step.subtitle!,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                      if (step.time?.isNotEmpty == true) ...[
                        const SizedBox(height: 4),
                        Text(
                          step.time!,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}

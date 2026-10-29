import 'package:flutter/material.dart';
import 'package:mobile/core/widgets/app_text.dart';

class StatusCard extends StatelessWidget {
  final String title;
  final String count;
  final IconData? icon;
  final Color? iconColor;
  final bool loading;
  final VoidCallback? onTap;

  const StatusCard({
    super.key,
    required this.title,
    required this.count,
    this.icon,
    this.iconColor,
    this.loading = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: loading ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 40),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: AppText.fromTheme(
                        title,
                        context: context,
                        type: AppTextType.h4,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (icon != null) ...[
                      const SizedBox(width: 8),
                      Icon(icon, color: iconColor ?? colorScheme.primary),
                    ],
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 36),
                  child: loading
                      ? const Align(
                          alignment: Alignment.centerLeft,
                          widthFactor: 1,
                          heightFactor: 1,
                          child: SizedBox.square(
                            dimension: 24,
                            child: CircularProgressIndicator(strokeWidth: 2.5),
                          ),
                        )
                      : Row(
                          children: [
                            Expanded(
                              child: AppText(
                                count,
                                type: AppTextType.h5,
                                fontSize: 28,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (onTap != null) ...[
                              const Icon(Icons.arrow_forward, size: 18),
                            ],
                          ],
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

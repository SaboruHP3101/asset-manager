import 'package:flutter/material.dart';

/// Centers an error message and a button that retries the failed action.
class RetryMessage extends StatelessWidget {
  const RetryMessage({
    super.key,
    required this.message,
    required this.onRetry,
    this.buttonSpacing = 12,
    this.padding = const EdgeInsets.all(24),
  });

  final String message;
  final VoidCallback onRetry;
  final double buttonSpacing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: padding,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          if (buttonSpacing > 0) SizedBox(height: buttonSpacing),
          FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

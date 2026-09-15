import 'package:flutter/material.dart';
import 'package:mobile/core/widgets/app_text.dart';

class StatusCard extends StatelessWidget {
  final String title;
  final String count;
  final IconData? icon;
  final Color? iconColor;

  const StatusCard({
    super.key,
    required this.title,
    required this.count,
    this.icon,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Color(0xFFF8F9FE),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                AppText.fromTheme(
                  title,
                  context: context,
                  type: AppTextType.h4,
                ),
                if (icon != null) Icon(icon, color: iconColor ?? Colors.blue),
              ],
            ),
            Container(
              margin: EdgeInsets.only(top: 4),
              child: AppText(count, type: AppTextType.h5, fontSize: 28),
            ),
          ],
        ),
      ),
    );
  }
}

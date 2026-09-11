import 'package:flutter/material.dart';

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
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w400,
                    color: Color(0xFF1F2024),
                  ),
                ),
                if (icon != null) Icon(icon, color: iconColor ?? Colors.blue),
              ],
            ),
            Container(
              margin: EdgeInsets.only(top: 4),
              child: Text(
                count,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

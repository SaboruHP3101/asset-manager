import 'package:flutter/material.dart';

import '../../../core/widgets/status_card.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trang chủ'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_note),
            tooltip: 'Show Snackbar',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('This is a snackbar')),
              );
            },
          ),
        ],
      ),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: .start,
          spacing: 16,
          children: [
            Column(
              crossAxisAlignment: .start,
              children: [
                Text(
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1F2024),
                  ),
                  'Chào buổi sáng, Bình!',
                ),
                Text(
                  style: const TextStyle(
                    fontSize: 16,
                    color: Color(0xFF1F2024),
                  ),
                  'Bạn đang có',
                ),
              ],
            ),
            Row(
              spacing: 12,
              children: [
                Expanded(
                  child: StatusCard(title: 'Tài sản được giao', count: '14'),
                ),
                Expanded(
                  child: StatusCard(title: 'Yêu cầu chờ duyệt', count: '14'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/requirement_grid.dart';
import '../../../core/widgets/status_card.dart';

class _RequirementGrid extends StatelessWidget {
  const _RequirementGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final cards = [
      RequirementCard(
        title: 'Yêu cầu sử dụng tài sản',
        icon: Icons.dashboard_customize,
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const Scaffold(
                body: Center(child: Text('Asset Usage Screen')),
              ),
            ),
          );
        },
      ),
      RequirementCard(
        title: 'Đề nghị mua mới',
        icon: Icons.shopping_bag,
        onTap: () {
          // Mở hộp thoại
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Đề nghị mua mới'),
              content: const Text('Dialog content here'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Đóng'),
                ),
              ],
            ),
          );
        },
      ),
      RequirementCard(
        title: 'Báo hỏng / Sửa chữa',
        icon: Icons.info_outline,
        onTap: () {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Báo hỏng / Sửa chữa')));
        },
      ),
      RequirementCard(
        title: 'Yêu cầu điều chuyển',
        icon: Icons.send,
        onTap: () {
          print('Yêu cầu điều chuyển tapped');
        },
      ),
    ];

    return RequirementGrid(cards: cards, cardHeight: 60, gap: 16);
  }
}

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
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 16,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppText.fromTheme(
                    'Chào buổi sáng, Bình!',
                    context: context,
                    type: AppTextType.h1,
                  ),
                  AppText.fromTheme(
                    'Bạn đang có',
                    context: context,
                    type: AppTextType.h2,
                  ),
                ],
              ),
              Row(
                spacing: 8,
                children: [
                  Expanded(
                    child: StatusCard(title: 'Tài sản được giao', count: '14'),
                  ),
                  Expanded(
                    child: StatusCard(title: 'Yêu cầu chờ duyệt', count: '14'),
                  ),
                ],
              ),
              AppText.fromTheme(
                'Tạo yêu cầu',
                context: context,
                type: AppTextType.h2,
              ),
              _RequirementGrid(),
            ],
          ),
        ),
      ),
    );
  }
}

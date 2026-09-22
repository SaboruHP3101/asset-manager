import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/requirement_grid.dart';
import '../../../core/widgets/status_card.dart';

class _RequirementGrid extends StatelessWidget {
  const _RequirementGrid();

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
          debugPrint('Yêu cầu điều chuyển tapped');
        },
      ),
    ];

    return RequirementGrid(cards: cards, cardHeight: 60, gap: 16);
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _dio = ApiClient.instance.dio;

  int? _assignedAssets;
  int? _activeRequests;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  // Tải các số liệu tổng hợp từ DB qua một endpoint dành riêng cho Home.
  Future<void> _loadSummary() async {
    if (mounted) setState(() => _loading = true);

    try {
      final response = await _dio.get<Map<String, dynamic>>('/dashboard/mine');
      if (!mounted) return;
      setState(() {
        _assignedAssets = response.data?['assignedAssets'] as int? ?? 0;
        _activeRequests = response.data?['activeRequests'] as int? ?? 0;
        _loading = false;
      });
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      final message = error.response?.statusCode == 401
          ? 'Phiên đăng nhập đã hết hạn.'
          : 'Không thể tải dữ liệu tổng quan.';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trang chủ'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: _loading
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
            tooltip: 'Tải lại',
            onPressed: _loading ? null : _loadSummary,
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
                    'Xin chào!',
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
                    child: StatusCard(
                      title: 'Tài sản được giao',
                      count: _assignedAssets?.toString() ?? '—',
                      loading: _loading,
                    ),
                  ),
                  Expanded(
                    child: StatusCard(
                      title: 'Yêu cầu đang xử lý',
                      count: _activeRequests?.toString() ?? '—',
                      loading: _loading,
                    ),
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

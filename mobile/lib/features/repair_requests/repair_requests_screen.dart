import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../login/login_screen.dart';
import 'repair_progress_screen.dart';
import 'repair_request_form.dart';

class RepairRequestsScreen extends StatefulWidget {
  const RepairRequestsScreen({super.key});

  @override
  State<RepairRequestsScreen> createState() => _RepairRequestsScreenState();
}

class _RepairRequestsScreenState extends State<RepairRequestsScreen> {
  final _dio = ApiClient.instance.dio;
  final _tokenStorage = TokenStorage.instance;
  List<Map<String, dynamic>> _mine = [];
  List<Map<String, dynamic>> _queue = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  // Tải danh sách yêu cầu sửa chữa của người dùng hiện tại.
  Future<void> _loadRequests() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final responses = await Future.wait([
        _dio.get<List<dynamic>>('/repair-requests/mine'),
        _dio.get<List<dynamic>>('/repair-requests/queue'),
      ]);
      if (!mounted) return;
      setState(() {
        _mine = (responses[0].data ?? []).cast<Map<String, dynamic>>();
        _queue = (responses[1].data ?? []).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        await _tokenStorage.clearAccessToken();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (_) => false,
        );
        return;
      }
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Không thể tải danh sách yêu cầu.';
        });
      }
    }
  }

  void _openProgress(Map<String, dynamic> request) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            RepairProgressScreen(requestId: request['id'] as String),
      ),
    );
  }

  // Mở form tạo yêu cầu và tải lại danh sách khi người dùng gửi thành công.
  Future<void> _openCreateRequest() async {
    final created = await Navigator.of(
      context,
    ).push<bool>(MaterialPageRoute(builder: (_) => const RepairRequestForm()));
    if (created == true && mounted) await _loadRequests();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Báo hỏng tài sản'),
          centerTitle: true,
          actions: [
            IconButton(
              onPressed: _openCreateRequest,
              tooltip: 'Tạo yêu cầu sửa chữa',
              icon: const Icon(Icons.add),
            ),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Phiếu của tôi'),
              Tab(text: 'Cần xử lý'),
            ],
          ),
        ),
        body: SafeArea(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  children: [
                    _RepairList(
                      requests: _mine,
                      error: _error,
                      emptyMessage: 'Bạn chưa có yêu cầu sửa chữa nào.',
                      onRefresh: _loadRequests,
                      onOpen: _openProgress,
                    ),
                    _RepairList(
                      requests: _queue,
                      error: _error,
                      emptyMessage: 'Không có phiếu cần xử lý.',
                      onRefresh: _loadRequests,
                      onOpen: _openProgress,
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _RepairList extends StatelessWidget {
  const _RepairList({
    required this.requests,
    required this.emptyMessage,
    required this.onRefresh,
    required this.onOpen,
    this.error,
  });

  final List<Map<String, dynamic>> requests;
  final String? error;
  final String emptyMessage;
  final Future<void> Function() onRefresh;
  final void Function(Map<String, dynamic>) onOpen;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: onRefresh,
    child: requests.isEmpty
        ? LayoutBuilder(
            builder: (context, constraints) => ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(
                  height: constraints.maxHeight,
                  child: Center(
                    child: _RequestMessage(
                      icon: error == null
                          ? Icons.assignment_outlined
                          : Icons.cloud_off_outlined,
                      message: error ?? emptyMessage,
                    ),
                  ),
                ),
              ],
            ),
          )
        : ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              for (final request in requests)
                RepairRequestCard(
                  request: request,
                  onTap: () => onOpen(request),
                ),
            ],
          ),
  );
}

class RepairRequestCard extends StatelessWidget {
  const RepairRequestCard({
    required this.request,
    required this.onTap,
    super.key,
  });

  final Map<String, dynamic> request;
  final VoidCallback onTap;

  String _statusText(String status) {
    const labels = {
      'draft': 'Bản nháp',
      'pending_department_head': 'Chờ Trưởng bộ phận',
      'pending_it_head': 'Chờ Trưởng IT',
      'revision_required': 'Cần chỉnh sửa',
      'pending_handover_confirmations': 'Chờ bàn giao',
      'reported': 'Đã tiếp nhận',
      'assessed': 'Đã đánh giá',
      'approval_pending': 'Chờ phê duyệt',
      'in_progress': 'Đang sửa chữa',
      'ready_for_return': 'Chờ nhận lại tài sản',
      'completed': 'Chờ nghiệm thu',
      'confirmed': 'Đã nghiệm thu',
      'rejected': 'Yêu cầu làm lại',
      'closed': 'Đã kết thúc',
      'cancelled': 'Đã hủy',
    };
    return labels[status] ?? status.replaceAll('_', ' ');
  }

  String? _imageUrl() {
    final value = request['imageUrl'] as String?;
    if (value == null) return null;
    return AppConfig.absoluteUrl(value);
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = _imageUrl();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            SizedBox(
              width: 104,
              height: 132,
              child: imageUrl == null
                  ? const ColoredBox(
                      color: Color(0xFFE8EAF0),
                      child: Icon(Icons.build_outlined, size: 40),
                    )
                  : Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const ColoredBox(
                        color: Color(0xFFE8EAF0),
                        child: Icon(Icons.broken_image_outlined, size: 40),
                      ),
                    ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request['assetName'] ?? '',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text('Mã tài sản: ${request['assetCode'] ?? ''}'),
                    const SizedBox(height: 8),
                    Chip(label: Text(_statusText(request['status'] ?? ''))),
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: Icon(Icons.chevron_right),
            ),
          ],
        ),
      ),
    );
  }
}

class _RequestMessage extends StatelessWidget {
  const _RequestMessage({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 48, color: Theme.of(context).colorScheme.outline),
        const SizedBox(height: 12),
        Text(message, textAlign: TextAlign.center),
      ],
    );
  }
}

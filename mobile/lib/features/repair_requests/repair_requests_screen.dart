import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../login/login_screen.dart';
import 'repair_progress_screen.dart';

class RepairRequestsScreen extends StatefulWidget {
  const RepairRequestsScreen({super.key});

  @override
  State<RepairRequestsScreen> createState() => _RepairRequestsScreenState();
}

class _RepairRequestsScreenState extends State<RepairRequestsScreen> {
  static const _apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  final _dio = Dio(BaseOptions(baseUrl: _apiUrl));
  final _storage = const FlutterSecureStorage();
  List<Map<String, dynamic>> _requests = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  @override
  void dispose() {
    _dio.close();
    super.dispose();
  }

  Future<void> _loadRequests() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await _storage.read(key: 'access_token');
      final response = await _dio.get<List<dynamic>>(
        '/repair-requests/mine',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      if (!mounted) return;
      setState(() {
        _requests = (response.data ?? []).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        await _storage.delete(key: 'access_token');
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
        builder: (_) => RepairProgressScreen(requestId: request['id'] as String),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yêu cầu'), centerTitle: true),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
          onRefresh: _loadRequests,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              if (_error != null)
                _RequestMessage(
                  icon: Icons.cloud_off_outlined,
                  message: _error!,
                  buttonText: 'Thử lại',
                  onPressed: _loadRequests,
                )
              else if (_requests.isEmpty)
                const _RequestMessage(
                  icon: Icons.assignment_outlined,
                  message: 'Bạn chưa có yêu cầu sửa chữa nào.',
                )
              else
                ..._requests.map(
                  (request) => RepairRequestCard(
                    request: request,
                    apiUrl: _apiUrl,
                    onTap: () => _openProgress(request),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class RepairRequestCard extends StatelessWidget {
  const RepairRequestCard({
    required this.request,
    required this.apiUrl,
    required this.onTap,
    super.key,
  });

  final Map<String, dynamic> request;
  final String apiUrl;
  final VoidCallback onTap;

  String _statusText(String status) {
    const labels = {
      'reported': 'Đã tiếp nhận',
      'assessed': 'Đã đánh giá',
      'approval_pending': 'Chờ phê duyệt',
      'in_progress': 'Đang sửa chữa',
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
    return value.startsWith('http') ? value : '$apiUrl$value';
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
  const _RequestMessage({
    required this.icon,
    required this.message,
    this.buttonText,
    this.onPressed,
  });

  final IconData icon;
  final String message;
  final String? buttonText;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 72),
      child: Column(
        children: [
          Icon(icon, size: 48, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          if (buttonText != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onPressed, child: Text(buttonText!)),
          ],
        ],
      ),
    );
  }
}

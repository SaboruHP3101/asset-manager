import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/widgets/vertical_timeline.dart';

class RepairProgressScreen extends StatefulWidget {
  const RepairProgressScreen({this.assetId, this.requestId, super.key})
      : assert(assetId != null || requestId != null);

  final String? assetId;
  final String? requestId;

  @override
  State<RepairProgressScreen> createState() => _RepairProgressScreenState();
}

class _RepairProgressScreenState extends State<RepairProgressScreen> {
  static const _apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  final _dio = Dio(BaseOptions(baseUrl: _apiUrl));
  final _storage = const FlutterSecureStorage();
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProgress();
  }

  @override
  void dispose() {
    _dio.close();
    super.dispose();
  }

  Future<void> _loadProgress() async {
    setState(() => _error = null);
    try {
      final token = await _storage.read(key: 'access_token');
      final endpoint = widget.requestId != null
          ? '/repair-requests/mine/${widget.requestId}/progress'
          : '/repair-requests/mine/asset/${widget.assetId}';
      final response = await _dio.get<Map<String, dynamic>>(
        endpoint,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      if (!mounted) return;
      setState(() => _data = response.data);
    } on DioException {
      if (mounted) setState(() => _error = 'Không thể tải tiến trình sửa chữa.');
    }
  }

  String _statusText(String status) {
    const labels = {
      'reported': 'Đã tiếp nhận',
      'assessed': 'Đã đánh giá',
      'approval_pending': 'Đang chờ duyệt',
      'in_progress': 'Đang sửa chữa',
      'completed': 'Chờ nghiệm thu',
      'confirmed': 'Đã nghiệm thu',
      'rejected': 'Yêu cầu làm lại',
      'closed': 'Đã kết thúc',
      'cancelled': 'Đã hủy',
    };
    return labels[status] ?? status.replaceAll('_', ' ');
  }

  String _actionText(String action) {
    const labels = {
      'reported': 'Đã gửi yêu cầu sửa chữa',
      'assessed': 'IT đã đánh giá tình trạng',
      'approval_confirmed': 'Trưởng bộ phận đã phê duyệt',
      'cancelled': 'Yêu cầu đã bị từ chối',
      'assigned': 'Đã phân công kỹ thuật viên',
      'completed': 'Đã hoàn thành sửa chữa',
      'confirmed': 'Người dùng đã nghiệm thu',
      'rejected': 'Người dùng yêu cầu xử lý lại',
    };
    return labels[action] ?? action.replaceAll('_', ' ');
  }

  String? _formatTime(Object? value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (date == null) return null;
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(date.day)}/${two(date.month)}/${date.year} '
        '${two(date.hour)}:${two(date.minute)}';
  }

  List<TimelineStep> _steps(Map<String, dynamic> data) {
    final request = data['request'] as Map<String, dynamic>;
    final events = (data['timeline'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final terminal = request['status'] == 'closed' || request['status'] == 'cancelled';

    return events.asMap().entries.map((entry) {
      final event = entry.value;
      final rejected = event['status'] == 'rejected';
      return TimelineStep(
        title: _actionText(event['actionType']?.toString() ?? ''),
        subtitle: event['notes']?.toString() ?? 'Thực hiện bởi ${event['approverRole']}',
        time: _formatTime(event['createdAt']),
        state: rejected
            ? TimelineStepState.rejected
            : (!terminal && entry.key == events.length - 1)
                ? TimelineStepState.current
                : TimelineStepState.completed,
      );
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Scaffold(
      appBar: AppBar(title: const Text('Tiến trình sửa chữa')),
      body: data == null
          ? Center(
              child: _error == null
                  ? const CircularProgressIndicator()
                  : FilledButton.tonal(onPressed: _loadProgress, child: const Text('Thử lại')),
            )
          : RefreshIndicator(
              onRefresh: _loadProgress,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.build_circle_outlined),
                      title: Text(_statusText(data['request']['status'])),
                      subtitle: Text(data['request']['issueDescription'] ?? ''),
                    ),
                  ),
                  const SizedBox(height: 24),
                  VerticalTimeline(steps: _steps(data)),
                ],
              ),
            ),
    );
  }
}

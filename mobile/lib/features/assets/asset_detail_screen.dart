import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/department_labels.dart';
import '../repair_requests/repair_request_form.dart';
import '../repair_requests/repair_progress_screen.dart';

class AssetDetailScreen extends StatefulWidget {
  const AssetDetailScreen({required this.assetId, super.key});

  final String assetId;

  @override
  State<AssetDetailScreen> createState() => _AssetDetailScreenState();
}

class _AssetDetailScreenState extends State<AssetDetailScreen> {
  final _dio = ApiClient.instance.dio;
  Map<String, dynamic>? _asset;
  Map<String, dynamic>? _repairProgress;
  bool _checkingRepair = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Tải thông tin đầy đủ của tài sản được chọn
    _loadAsset();
  }

  // Gọi API chi tiết bằng token đăng nhập hiện tại
  Future<void> _loadAsset() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/assets/mine/${widget.assetId}',
      );
      if (mounted) setState(() => _asset = response.data);
      await _loadRepairProgress();
    } on DioException {
      if (mounted) setState(() => _error = 'Không thể tải chi tiết tài sản.');
    }
  }

  // Kiểm tra request gần nhất để nút sửa chữa phản ánh đúng dữ liệu trong DB.
  Future<void> _loadRepairProgress() async {
    try {
      final response = await _dio.get<Object?>(
        '/repair-requests/mine/asset/${widget.assetId}',
      );
      if (!mounted) return;
      setState(() {
        _repairProgress = response.data as Map<String, dynamic>?;
        _checkingRepair = false;
      });
    } on DioException {
      if (mounted) setState(() => _checkingRepair = false);
    }
  }

  // Sau khi tạo request thành công, tải lại trạng thái để đổi nút ngay lập tức.
  Future<void> _openRepairAction() async {
    if (_repairProgress != null) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => RepairProgressScreen(assetId: widget.assetId),
        ),
      );
      await _loadRepairProgress();
      return;
    }

    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => RepairRequestForm(initialAssetId: widget.assetId),
      ),
    );
    if (created == true) await _loadRepairProgress();
  }

  // Ghép địa chỉ API cho ảnh được lưu ở backend
  String? _imageUrl() {
    final url = _asset?['imageUrl'] as String?;
    if (url == null) return null;
    return AppConfig.absoluteUrl(url);
  }

  // Đổi trạng thái kỹ thuật thành nội dung tiếng Việt
  String _statusText(String status) {
    if (status == 'in_use' || status == 'using') return 'Đang sử dụng';
    if (status == 'repairing' || status == 'fixing') return 'Đang sửa chữa';
    if (status == 'available') return 'Sẵn sàng';
    return status.replaceAll('_', ' ');
  }

  // Hiển thị một dòng thông tin của tài sản
  Widget _detailRow(String label, String? value) {
    return ListTile(
      title: Text(label),
      trailing: SizedBox(
        width: 180,
        child: Text(
          value?.isNotEmpty == true ? value! : 'Chưa cập nhật',
          textAlign: TextAlign.end,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asset = _asset;

    // Hiển thị trạng thái tải hoặc lỗi trước khi có dữ liệu
    if (asset == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chi tiết tài sản')),
        body: Center(
          child: _error == null
              ? const CircularProgressIndicator()
              : FilledButton.tonal(
                  onPressed: () {
                    setState(() => _error = null);
                    _loadAsset();
                  },
                  child: const Text('Thử lại'),
                ),
        ),
      );
    }

    final imageUrl = _imageUrl();

    // Bố cục ảnh lớn, danh sách chi tiết và nút sửa chữa
    return Scaffold(
      appBar: AppBar(title: Text(asset['name'] ?? 'Tài sản')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: SizedBox(
                height: 240,
                child: imageUrl == null
                    ? const ColoredBox(
                        color: Color(0xFFE8EAF0),
                        child: Icon(Icons.inventory_2_outlined, size: 72),
                      )
                    : Image.network(
                        imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const ColoredBox(
                          color: Color(0xFFE8EAF0),
                          child: Icon(Icons.broken_image_outlined, size: 72),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Column(
                children: [
                  _detailRow('Mã tài sản', asset['assetCode']),
                  _detailRow('Danh mục', asset['category']),
                  _detailRow(
                    'Phòng ban',
                    departmentLabel(asset['department'] as String?),
                  ),
                  _detailRow('Trạng thái', _statusText(asset['status'] ?? '')),
                  _detailRow('Ngày mua', asset['purchaseDate']),
                  _detailRow('Ngày sử dụng', asset['inServiceDate']),
                  _detailRow('Nhà cung cấp', asset['supplier']),
                  _detailRow('Nguyên giá', '${asset['initialValue']} VNĐ'),
                ],
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _checkingRepair ? null : _openRepairAction,
              icon: _checkingRepair
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      _repairProgress == null
                          ? Icons.build_outlined
                          : Icons.timeline_outlined,
                    ),
              label: Text(
                _repairProgress == null
                    ? 'Gửi yêu cầu sửa chữa'
                    : 'Xem tiến trình sửa chữa',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

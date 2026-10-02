import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pretty_qr_code/pretty_qr_code.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/department_labels.dart';
import '../repair_requests/repair_progress_screen.dart';
import '../repair_requests/repair_request_form.dart';
import 'asset_status_chip.dart';

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
  bool _detailsLoaded = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAsset();
  }

  Future<void> _loadAsset() async {
    setState(() => _error = null);
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/assets/mine/${widget.assetId}',
      );
      if (!mounted) return;
      setState(() {
        _asset = response.data;
        _detailsLoaded = true;
      });
      await _loadRepairProgress();
    } on DioException {
      if (mounted) setState(() => _error = 'Không thể tải chi tiết tài sản.');
    }
  }

  Future<void> _loadRepairProgress() async {
    setState(() => _checkingRepair = true);
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

  Future<void> _openRepairAction() async {
    if (_repairProgress != null) {
      await Navigator.of(context).push<void>(
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

  String? _imageUrl() {
    final url = _asset?['imageUrl'] as String?;
    return url == null ? null : AppConfig.absoluteUrl(url);
  }

  Future<void> _showQrInfo() async {
    final qrCode = _asset?['qrCode'] as String?;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mã QR tài sản'),
        content: qrCode?.isNotEmpty == true
            ? AssetQrCodeView(data: qrCode!)
            : const Text('Chưa cập nhật mã QR', textAlign: TextAlign.center),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
          if (qrCode?.isNotEmpty == true)
            FilledButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: qrCode!));
                Navigator.pop(context);
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(content: Text('Đã sao chép mã QR.')),
                );
              },
              icon: const Icon(Icons.copy),
              label: const Text('Sao chép'),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asset = _asset;
    if (asset == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chi tiết tài sản')),
        body: _error == null
            ? const _AssetDetailSkeleton()
            : _DetailError(onRetry: _loadAsset),
      );
    }

    final history = (asset['handoverHistory'] as List<dynamic>? ?? const [])
        .cast<Object>();

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết tài sản')),
      body: RefreshIndicator(
        onRefresh: _loadAsset,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _AssetHero(
              asset: asset,
              assetId: widget.assetId,
              imageUrl: _imageUrl(),
            ),
            if (!_detailsLoaded)
              _error == null
                  ? const _AssetInfoSkeleton()
                  : _AssetInfoError(onRetry: _loadAsset)
            else ...[
              if (_repairProgress != null) ...[
                const SizedBox(height: 12),
                Card(
                  color: Theme.of(context).colorScheme.tertiaryContainer,
                  child: const ListTile(
                    leading: Icon(Icons.build_circle_outlined),
                    title: Text('Đang có yêu cầu sửa chữa'),
                    subtitle: Text('Theo dõi tiến trình bằng nút phía dưới.'),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              _DetailSection(
                title: 'Thông tin sử dụng',
                icon: Icons.person_pin_circle_outlined,
                children: [
                  _InfoRow(
                    icon: Icons.person_outline,
                    label: 'Người sử dụng',
                    value: _value(asset['assignedTo']),
                  ),
                  _InfoRow(
                    icon: Icons.location_on_outlined,
                    label: 'Vị trí',
                    value: _value(asset['currentLocation']),
                  ),
                  _InfoRow(
                    icon: Icons.apartment_outlined,
                    label: 'Phòng ban',
                    value:
                        departmentLabel(asset['department'] as String?) ??
                        'Chưa cập nhật',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _DetailSection(
                title: 'Thông tin tài sản',
                icon: Icons.inventory_2_outlined,
                children: [
                  _InfoRow(
                    icon: Icons.tag,
                    label: 'Mã tài sản',
                    value: _value(asset['assetCode']),
                  ),
                  _InfoRow(
                    icon: Icons.category_outlined,
                    label: 'Danh mục',
                    value: _value(asset['category']),
                  ),
                  _InfoRow(
                    icon: Icons.event_available_outlined,
                    label: 'Ngày sử dụng',
                    value: _formatDate(asset['inServiceDate']),
                  ),
                  ListTile(
                    leading: const Icon(Icons.qr_code_2),
                    title: const Text('Mã QR'),
                    subtitle: Text(_value(asset['qrCode'])),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: _showQrInfo,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _DetailSection(
                title: 'Thông tin mua sắm',
                icon: Icons.receipt_long_outlined,
                children: [
                  _InfoRow(
                    icon: Icons.storefront_outlined,
                    label: 'Nhà cung cấp',
                    value: _value(asset['supplier']),
                  ),
                  _InfoRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Ngày mua',
                    value: _formatDate(asset['purchaseDate']),
                  ),
                  _InfoRow(
                    icon: Icons.payments_outlined,
                    label: 'Nguyên giá',
                    value: _formatCurrency(asset['initialValue']),
                  ),
                ],
              ),
              if (history.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text(
                  'Vòng đời tài sản',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Column(
                      children: [
                        for (var index = 0; index < history.length; index++)
                          _HandoverTimelineItem(
                            entry: Map<String, dynamic>.from(
                              history[index] as Map,
                            ),
                            isLast: index == history.length - 1,
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
      bottomNavigationBar: !_detailsLoaded
          ? null
          : Material(
              elevation: 8,
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                  child: FilledButton.icon(
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
                ),
              ),
            ),
    );
  }
}

class AssetQrCodeView extends StatelessWidget {
  const AssetQrCodeView({required this.data, super.key});

  final String data;

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: 'Mã QR tài sản',
    child: SizedBox.square(
      dimension: 240,
      child: PrettyQrView.data(
        data: data,
        decoration: PrettyQrDecoration(
          shape: PrettyQrSmoothSymbol(
            color: Theme.of(context).colorScheme.onSurface,
            roundFactor: 0.45,
          ),
          quietZone: const PrettyQrQuietZone.modules(2),
        ),
      ),
    ),
  );
}

class _AssetHero extends StatelessWidget {
  const _AssetHero({
    required this.asset,
    required this.assetId,
    required this.imageUrl,
  });

  final Map<String, dynamic> asset;
  final String assetId;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(12),
    child: SizedBox(
      height: 280,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Hero(
            tag: 'asset-image-$assetId',
            child: imageUrl == null
                ? ColoredBox(
                    color: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest,
                    child: const Icon(Icons.inventory_2_outlined, size: 72),
                  )
                : Image.network(
                    imageUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => ColoredBox(
                      color: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest,
                      child: const Icon(Icons.broken_image_outlined, size: 72),
                    ),
                  ),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Color(0xCC101319)],
                stops: [0.35, 1],
              ),
            ),
          ),
          Positioned(
            left: 18,
            right: 18,
            bottom: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AssetStatusChip(status: asset['status'] as String? ?? ''),
                const SizedBox(height: 10),
                Text(
                  asset['name'] as String? ?? 'Tài sản',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  asset['assetCode'] as String? ?? 'Chưa có mã tài sản',
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(8, 14, 8, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              children: [
                Icon(icon, size: 20),
                const SizedBox(width: 8),
                Text(title, style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
          ),
          const Divider(height: 20),
          ...children,
        ],
      ),
    ),
  );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => ListTile(
    dense: true,
    leading: Icon(icon),
    title: Text(label),
    subtitle: Text(
      value,
      style: Theme.of(context).textTheme.bodyLarge
          ?.copyWith(fontWeight: FontWeight.w500),
    ),
  );
}

class _HandoverTimelineItem extends StatelessWidget {
  const _HandoverTimelineItem({required this.entry, required this.isLast});

  final Map<String, dynamic> entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 48,
          child: Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.handshake_outlined, size: 16),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(0, 3, 14, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _handoverTypeLabel(entry['handoverType'] as String?),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 3),
                Text(
                  entry['recipientName'] as String? ??
                      'Chưa cập nhật người nhận',
                ),
                Text(
                  '${departmentLabel(entry['departmentName'] as String?) ?? 'Chưa có phòng ban'}'
                  ' • ${_formatDate(entry['handoverDate'])}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if ((entry['note'] as String?)?.isNotEmpty ?? false) ...[
                  const SizedBox(height: 4),
                  Text(entry['note'] as String),
                ],
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _AssetDetailSkeleton extends StatelessWidget {
  const _AssetDetailSkeleton();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Container(
        height: 280,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      const SizedBox(height: 16),
      for (var index = 0; index < 3; index++) ...[
        Container(
          height: 160,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        const SizedBox(height: 12),
      ],
    ],
  );
}

class _AssetInfoSkeleton extends StatelessWidget {
  const _AssetInfoSkeleton();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 16),
    child: Column(
      children: [
        for (var index = 0; index < 3; index++) ...[
          Container(
            height: 154,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          if (index < 2) const SizedBox(height: 12),
        ],
      ],
    ),
  );
}

class _AssetInfoError extends StatelessWidget {
  const _AssetInfoError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 16),
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Text('Không thể tải đầy đủ thông tin tài sản.'),
            const SizedBox(height: 10),
            OutlinedButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ),
      ),
    ),
  );
}

class _DetailError extends StatelessWidget {
  const _DetailError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.cloud_off_outlined,
          size: 52,
          color: Theme.of(context).colorScheme.outline,
        ),
        const SizedBox(height: 12),
        const Text('Không thể tải chi tiết tài sản.'),
        const SizedBox(height: 12),
        FilledButton.tonal(onPressed: onRetry, child: const Text('Thử lại')),
      ],
    ),
  );
}

String _value(Object? value) {
  final text = value?.toString().trim();
  return text?.isNotEmpty == true ? text! : 'Chưa cập nhật';
}

String _formatDate(Object? value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) return 'Chưa cập nhật';
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;

  return '${parsed.day.toString().padLeft(2, '0')}/'
      '${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
}

String _formatCurrency(Object? value) {
  if (value == null) return 'Chưa cập nhật';
  final number = num.tryParse(value.toString());
  if (number == null) return value.toString();
  final digits = number.round().toString();
  final formatted = digits.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );

  return '$formatted ₫';
}

String _handoverTypeLabel(String? type) => switch (type) {
  'allocation' || 'initial' => 'Cấp phát tài sản',
  'reallocation' || 'transfer' => 'Bàn giao lại tài sản',
  'return' => 'Thu hồi tài sản',
  null || '' => 'Bàn giao tài sản',
  _ => type.replaceAll('_', ' '),
};

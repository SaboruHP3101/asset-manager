import 'package:flutter/material.dart';
import 'package:pretty_qr_code/pretty_qr_code.dart';

import '../../core/utils/department_labels.dart';
import '../../core/utils/display_date.dart';
import '../../core/utils/group_display_digits.dart';
import 'asset_status_chip.dart';

class AssetInformation extends StatelessWidget {
  const AssetInformation({
    required this.asset,
    required this.hasActiveRepair,
    required this.onShowQrInfo,
    super.key,
  });

  final Map<String, dynamic> asset;
  final bool hasActiveRepair;
  final VoidCallback onShowQrInfo;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (hasActiveRepair) ...[
        const SizedBox(height: 12),
        Card(
          color: Theme.of(context).colorScheme.tertiaryContainer,
          child: const ListTile(
            leading: Icon(Icons.build_circle_outlined),
            title: Text('Đang có yêu cầu sửa chữa'),
            subtitle: Text('Chọn “Xem tiến trình sửa chữa” trong nút Yêu cầu.'),
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
            onTap: onShowQrInfo,
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
    ],
  );
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

class AssetHero extends StatelessWidget {
  const AssetHero({
    super.key,
    required this.asset,
    required this.assetId,
    required this.imageUrl,
  });

  final Map<String, dynamic> asset;
  final String assetId;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(24),
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
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
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

class AssetDetailSkeleton extends StatelessWidget {
  const AssetDetailSkeleton({super.key});

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

class AssetInfoSkeleton extends StatelessWidget {
  const AssetInfoSkeleton({super.key});

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

class AssetInfoError extends StatelessWidget {
  const AssetInfoError({required this.onRetry, super.key});

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

class AssetDetailError extends StatelessWidget {
  const AssetDetailError({required this.onRetry, super.key});

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

  return formatDisplayDate(parsed);
}

String _formatCurrency(Object? value) {
  if (value == null) return 'Chưa cập nhật';
  final number = num.tryParse(value.toString());
  if (number == null) return value.toString();
  final formatted = groupDisplayDigits(number.round().toString());

  return '$formatted ₫';
}

import 'package:flutter/material.dart';

import '../../core/config/app_config.dart';
import '../../core/utils/department_labels.dart';
import 'asset_status_chip.dart';

class AssetCard extends StatelessWidget {
  const AssetCard({required this.asset, required this.onTap, super.key});

  final Map<String, dynamic> asset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final rawImageUrl = asset['imageUrl'] as String?;
    final imageUrl = rawImageUrl == null
        ? null
        : AppConfig.absoluteUrl(rawImageUrl);
    final assetId = asset['id'] as String;

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              Hero(
                tag: 'asset-image-$assetId',
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox.square(
                    dimension: 88,
                    child: _AssetImage(imageUrl: imageUrl, iconSize: 34),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      asset['name'] as String? ?? 'Tài sản',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      asset['assetCode'] as String? ?? 'Chưa có mã tài sản',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 9),
                    AssetStatusChip(
                      status: asset['status'] as String? ?? '',
                      compact: true,
                    ),
                    const SizedBox(height: 7),
                    Row(
                      children: [
                        Icon(
                          Icons.apartment_outlined,
                          size: 16,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            departmentLabel(asset['department'] as String?) ??
                                'Chưa có phòng ban',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _AssetImage extends StatelessWidget {
  const _AssetImage({required this.imageUrl, required this.iconSize});

  final String? imageUrl;
  final double iconSize;

  @override
  Widget build(BuildContext context) => imageUrl == null
      ? _placeholder(context, Icons.inventory_2_outlined)
      : Image.network(
          imageUrl!,
          fit: BoxFit.cover,
          frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
            if (wasSynchronouslyLoaded) return child;

            return AnimatedOpacity(
              opacity: frame == null ? 0 : 1,
              duration: const Duration(milliseconds: 220),
              child: child,
            );
          },
          errorBuilder: (_, _, _) =>
              _placeholder(context, Icons.broken_image_outlined),
        );

  Widget _placeholder(BuildContext context, IconData icon) => ColoredBox(
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: Center(child: Icon(icon, size: iconSize)),
  );
}

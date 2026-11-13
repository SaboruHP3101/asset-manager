import 'package:flutter/material.dart';

enum AssetAction { recall, upgrade, repair }

class AssetActionSheet extends StatelessWidget {
  const AssetActionSheet({
    required this.isItManaged,
    required this.hasActiveRepair,
    required this.hasActiveRecall,
    required this.activeRecallType,
    super.key,
  });

  final bool isItManaged;
  final bool hasActiveRepair;
  final bool hasActiveRecall;
  final String? activeRecallType;

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Yêu cầu tài sản',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              IconButton(
                tooltip: 'Đóng thao tác',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (isItManaged) ...[
            ListTile(
              enabled: !hasActiveRepair || hasActiveRecall,
              leading: Icon(
                activeRecallType == 'upgrade'
                    ? Icons.upgrade
                    : Icons.swap_horiz,
              ),
              title: Text(
                !hasActiveRecall
                    ? 'Đổi / báo phế tài sản'
                    : activeRecallType == 'upgrade'
                    ? 'Xem phiếu nâng cấp tài sản'
                    : 'Xem phiếu thu hồi tài sản',
              ),
              onTap: () => Navigator.pop(context, AssetAction.recall),
            ),
            if (!hasActiveRecall)
              ListTile(
                enabled: !hasActiveRepair,
                leading: const Icon(Icons.upgrade),
                title: const Text('Yêu cầu nâng cấp tài sản'),
                onTap: () => Navigator.pop(context, AssetAction.upgrade),
              ),
          ],
          ListTile(
            enabled: !hasActiveRecall || hasActiveRepair,
            leading: Icon(
              !hasActiveRepair ? Icons.build_outlined : Icons.timeline_outlined,
            ),
            title: Text(
              !hasActiveRepair
                  ? 'Gửi yêu cầu sửa chữa'
                  : 'Xem tiến trình sửa chữa',
            ),
            onTap: () => Navigator.pop(context, AssetAction.repair),
          ),
        ],
      ),
    ),
  );
}

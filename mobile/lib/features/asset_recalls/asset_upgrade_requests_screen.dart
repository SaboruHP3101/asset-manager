import 'package:flutter/material.dart';

import 'asset_recall_requests_screen.dart';
import 'asset_recalls_repository.dart';

class AssetUpgradeRequestsScreen extends StatelessWidget {
  const AssetUpgradeRequestsScreen({
    super.key,
    this.initialTab = AssetRecallInitialTab.mine,
    this.repository,
  });

  final AssetRecallInitialTab initialTab;
  final AssetRecallsRepository? repository;

  @override
  Widget build(BuildContext context) => AssetRecallRequestsScreen(
    initialTab: initialTab,
    repository: repository,
    typeFilter: 'upgrade',
    title: 'Nâng cấp tài sản',
  );
}

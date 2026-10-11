import 'package:flutter/material.dart';

import 'asset_recall_form.dart';
import 'asset_recalls_repository.dart';

class AssetUpgradeForm extends StatelessWidget {
  const AssetUpgradeForm({
    required this.assetId,
    required this.assetName,
    super.key,
    this.assetCode,
    this.assetCategory,
    this.assetLocation,
    this.assetImageUrl,
    this.repository,
  });

  final String assetId;
  final String assetName;
  final String? assetCode;
  final String? assetCategory;
  final String? assetLocation;
  final String? assetImageUrl;
  final AssetRecallsRepository? repository;

  @override
  Widget build(BuildContext context) => AssetRecallForm(
    assetId: assetId,
    assetName: assetName,
    assetCode: assetCode,
    assetCategory: assetCategory,
    assetLocation: assetLocation,
    assetImageUrl: assetImageUrl,
    fixedType: 'upgrade',
    repository: repository,
  );
}

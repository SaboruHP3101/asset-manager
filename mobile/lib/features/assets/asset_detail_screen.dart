import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../asset_recalls/asset_recall_detail_screen.dart';
import '../asset_recalls/asset_recall_form.dart';
import '../asset_recalls/asset_upgrade_form.dart';
import '../repair_requests/repair_progress_screen.dart';
import '../repair_requests/repair_request_form.dart';
import 'asset_action_sheet.dart';
import 'asset_detail_content.dart';

export 'asset_detail_content.dart' show AssetQrCodeView;

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
      final progress = response.data as Map<String, dynamic>?;
      final request = progress?['request'];
      final status = request is Map ? request['status'] : null;
      setState(() {
        _repairProgress = status == 'closed' || status == 'cancelled'
            ? null
            : progress;
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

  Future<void> _openRecallAction({
    required String? existingRequestId,
    bool upgrade = false,
  }) async {
    final asset = _asset!;
    var requestId = existingRequestId;

    if (requestId == null) {
      final result = await Navigator.of(context).push<AssetRecallFormResult>(
        MaterialPageRoute(
          builder: (_) => upgrade
              ? AssetUpgradeForm(
                  assetId: widget.assetId,
                  assetName: asset['name'] as String? ?? 'Tài sản',
                  assetCode: asset['assetCode'] as String?,
                  assetCategory: asset['category'] as String?,
                  assetLocation: asset['currentLocation'] as String?,
                  assetImageUrl: _imageUrl(),
                )
              : AssetRecallForm(
                  assetId: widget.assetId,
                  assetName: asset['name'] as String? ?? 'Tài sản',
                  assetCode: asset['assetCode'] as String?,
                  assetCategory: asset['category'] as String?,
                  assetLocation: asset['currentLocation'] as String?,
                  assetImageUrl: _imageUrl(),
                ),
        ),
      );
      requestId = result?.id;
    }
    if (requestId == null || !mounted) return;

    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => AssetRecallDetailScreen(requestId: requestId!),
      ),
    );
    await _loadAsset();
  }

  Future<void> _showActions() async {
    final asset = _asset!;
    final activeRecall = asset['activeRecall'] == null
        ? null
        : Map<String, dynamic>.from(asset['activeRecall'] as Map);
    final activeRecallType = activeRecall?['type'] as String?;
    final action = await showModalBottomSheet<AssetAction>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => AssetActionSheet(
        isItManaged: asset['managementOwner'] == 'it',
        hasActiveRepair: _repairProgress != null,
        hasActiveRecall: activeRecall != null,
        activeRecallType: activeRecallType,
      ),
    );
    if (!mounted || action == null) return;
    switch (action) {
      case AssetAction.recall:
        await _openRecallAction(
          existingRequestId: activeRecall?['id'] as String?,
          upgrade: activeRecallType == 'upgrade',
        );
      case AssetAction.upgrade:
        await _openRecallAction(existingRequestId: null, upgrade: true);
      case AssetAction.repair:
        await _openRepairAction();
    }
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
            ? const AssetDetailSkeleton()
            : AssetDetailError(onRetry: _loadAsset),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết tài sản')),
      body: RefreshIndicator(
        onRefresh: _loadAsset,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(
            16,
            8,
            16,
            104 + MediaQuery.paddingOf(context).bottom,
          ),
          children: [
            AssetHero(
              asset: asset,
              assetId: widget.assetId,
              imageUrl: _imageUrl(),
            ),
            if (!_detailsLoaded)
              _error == null
                  ? const AssetInfoSkeleton()
                  : AssetInfoError(onRetry: _loadAsset)
            else ...[
              AssetInformation(
                asset: asset,
                hasActiveRepair: _repairProgress != null,
                onShowQrInfo: _showQrInfo,
              ),
            ],
          ],
        ),
      ),
      floatingActionButton: !_detailsLoaded
          ? null
          : FloatingActionButton.extended(
              tooltip: 'Yêu cầu tài sản',
              onPressed: _checkingRepair ? null : _showActions,
              icon: _checkingRepair
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add),
              label: const Text('Yêu cầu'),
            ),
    );
  }
}

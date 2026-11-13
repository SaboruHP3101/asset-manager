import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'asset_recall_action_panel.dart';
import 'asset_recall_detail_content.dart';
import 'asset_recall_dialogs.dart';
import 'asset_recall_form.dart';
import 'asset_recall_models.dart';
import 'asset_recalls_repository.dart';

class AssetRecallDetailScreen extends StatefulWidget {
  const AssetRecallDetailScreen({
    required this.requestId,
    super.key,
    this.repository,
  });

  final String requestId;
  final AssetRecallsRepository? repository;

  @override
  State<AssetRecallDetailScreen> createState() =>
      _AssetRecallDetailScreenState();
}

class _AssetRecallDetailScreenState extends State<AssetRecallDetailScreen> {
  late final AssetRecallsRepository _repository;
  Map<String, dynamic>? _request;
  String? _error;
  bool _acting = false;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? AssetRecallsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final request = await _repository.findOne(widget.requestId);
      if (mounted) setState(() => _request = request);
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = recallErrorMessage(
          error.response?.data,
          'Không thể tải phiếu đổi tài sản.',
        );
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _acting = true);
    try {
      await action();
      await _load();
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            recallErrorMessage(error.response?.data, 'Không thể xử lý phiếu.'),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<String?> _selectReplacement() async {
    List<Map<String, dynamic>> candidates;

    try {
      candidates = await _repository.findExchangeCandidates();
    } on DioException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              recallErrorMessage(
                error.response?.data,
                'Không thể tải tài sản trong kho IT.',
              ),
            ),
          ),
        );
      }

      return null;
    }
    if (!mounted) return null;
    if (candidates.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kho IT chưa có tài sản sẵn sàng.')),
      );
      return null;
    }

    return showRecallReplacementDialog(context, candidates);
  }

  Future<void> _edit() async {
    final request = _request!;
    final asset = Map<String, dynamic>.from(request['asset'] as Map);
    final result = await Navigator.of(context).push<AssetRecallFormResult>(
      MaterialPageRoute(
        builder: (_) => AssetRecallForm(
          assetId: asset['id'] as String,
          assetName: asset['name'] as String? ?? asset['assetCode'] as String,
          assetCode: asset['assetCode'] as String?,
          assetCategory: asset['category'] as String?,
          assetLocation: asset['currentLocation'] as String?,
          requestId: request['id'] as String,
          initialReason: request['reason'] as String? ?? '',
          initialType: request['type'] as String? ?? 'exchange',
          revisionRequired: request['status'] == 'revision_required',
          repository: _repository,
        ),
      ),
    );
    if (result != null) await _load();
  }

  List<String> get _actions =>
      (_request?['allowedActions'] as List<dynamic>? ?? const [])
          .cast<String>();

  @override
  Widget build(BuildContext context) {
    final request = _request;
    if (request == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Phiếu đổi tài sản')),
        body: Center(
          child: _error == null
              ? const CircularProgressIndicator()
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
        ),
      );
    }

    final type = request['type'] as String? ?? 'exchange';
    final title = switch (type) {
      'disposal' => 'Phiếu báo phế',
      'upgrade' => 'Phiếu nâng cấp',
      _ => 'Phiếu đổi tài sản',
    };
    final actionArea = buildRecallActionPanel(
      context,
      requestId: widget.requestId,
      requestType: request['type'],
      allowedActions: _actions,
      acting: _acting,
      onEdit: _edit,
      selectReplacement: _selectReplacement,
      repository: _repository,
      run: _run,
    );

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: AssetRecallDetailContent(
          request: request,
          type: type,
          allowedActions: _actions,
        ),
      ),
      bottomNavigationBar: actionArea == null
          ? null
          : Material(
              elevation: 8,
              child: SafeArea(top: false, child: actionArea),
            ),
    );
  }
}

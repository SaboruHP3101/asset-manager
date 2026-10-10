import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'asset_recall_models.dart';
import 'asset_recalls_repository.dart';

class AssetRecallFormResult {
  const AssetRecallFormResult({required this.id, required this.submitted});

  final String id;
  final bool submitted;
}

class AssetRecallForm extends StatefulWidget {
  const AssetRecallForm({
    required this.assetId,
    required this.assetName,
    super.key,
    this.assetCode,
    this.assetCategory,
    this.assetLocation,
    this.assetImageUrl,
    this.requestId,
    this.initialReason = '',
    this.revisionRequired = false,
    this.repository,
  });

  final String assetId;
  final String assetName;
  final String? assetCode;
  final String? assetCategory;
  final String? assetLocation;
  final String? assetImageUrl;
  final String? requestId;
  final String initialReason;
  final bool revisionRequired;
  final AssetRecallsRepository? repository;

  @override
  State<AssetRecallForm> createState() => _AssetRecallFormState();
}

class _AssetRecallFormState extends State<AssetRecallForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _reasonController;
  late final AssetRecallsRepository _repository;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? AssetRecallsRepository();
    _reasonController = TextEditingController(text: widget.initialReason);
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<String> _saveDraft() async {
    final request = widget.requestId == null
        ? await _repository.create(
            assetId: widget.assetId,
            reason: _reasonController.text.trim(),
          )
        : await _repository.update(
            id: widget.requestId!,
            reason: _reasonController.text.trim(),
          );

    return request['id'] as String;
  }

  Future<void> _save({required bool submit}) async {
    if (submit && !_formKey.currentState!.validate()) return;
    if (submit && !await _review()) return;
    setState(() => _saving = true);

    try {
      final id = await _saveDraft();

      if (submit) {
        await _repository.submit(id, resubmit: widget.revisionRequired);
      }
      if (!mounted) return;
      Navigator.pop(context, AssetRecallFormResult(id: id, submitted: submit));
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            recallErrorMessage(
              error.response?.data,
              'Không thể lưu phiếu đổi tài sản.',
            ),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<bool> _review() async =>
      (await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) => _RecallReviewSheet(
          assetName: widget.assetName,
          assetCode: widget.assetCode,
          reason: _reasonController.text.trim(),
        ),
      )) ??
      false;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Phiếu đổi tài sản')),
    body: Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const _RecallProgress(),
          const SizedBox(height: 16),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _AssetThumbnail(imageUrl: widget.assetImageUrl),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.assetName,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        if (widget.assetCode?.isNotEmpty == true)
                          Text('Mã: ${widget.assetCode}'),
                        if (widget.assetCategory?.isNotEmpty == true)
                          Text('Danh mục: ${widget.assetCategory}'),
                        if (widget.assetLocation?.isNotEmpty == true)
                          Text('Vị trí: ${widget.assetLocation}'),
                        const SizedBox(height: 8),
                        const _ManagedByItBadge(),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _reasonController,
            minLines: 4,
            maxLines: 7,
            maxLength: 2000,
            decoration: const InputDecoration(
              labelText: 'Lý do đổi tài sản',
              hintText: 'Mô tả nhu cầu và tình trạng tài sản hiện tại',
              helperText: 'Có thể để trống khi lưu nháp.',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
            validator: (value) => value?.trim().isEmpty ?? true
                ? 'Vui lòng nhập lý do đổi tài sản.'
                : null,
          ),
        ],
      ),
    ),
    bottomNavigationBar: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _saving ? null : () => _save(submit: false),
                child: const Text('Lưu nháp'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: _saving ? null : () => _save(submit: true),
                child: _saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Kiểm tra & gửi'),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _RecallProgress extends StatelessWidget {
  const _RecallProgress();

  @override
  Widget build(BuildContext context) {
    const steps = [
      ('Tạo phiếu', Icons.edit_document),
      ('Trưởng BP', Icons.supervisor_account_outlined),
      ('Trưởng IT', Icons.admin_panel_settings_outlined),
      ('Bàn giao', Icons.swap_horiz),
    ];
    final colors = Theme.of(context).colorScheme;

    return Semantics(
      label: 'Bước 1 trên 4: Tạo phiếu',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Quy trình đổi tài sản',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (var index = 0; index < steps.length; index++) ...[
                Expanded(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: index == 0
                            ? colors.primary
                            : colors.surfaceContainerHighest,
                        foregroundColor: index == 0
                            ? colors.onPrimary
                            : colors.onSurfaceVariant,
                        child: Icon(steps[index].$2, size: 19),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        steps[index].$1,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ],
                  ),
                ),
                if (index < steps.length - 1)
                  Container(
                    width: 14,
                    height: 2,
                    margin: const EdgeInsets.only(bottom: 28),
                    color: colors.outlineVariant,
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _AssetThumbnail extends StatelessWidget {
  const _AssetThumbnail({required this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 92,
    height: 142,
    child: imageUrl?.isNotEmpty == true
        ? Image.network(
            imageUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => const _AssetPlaceholder(),
          )
        : const _AssetPlaceholder(),
  );
}

class _ManagedByItBadge extends StatelessWidget {
  const _ManagedByItBadge();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.secondaryContainer,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.computer_outlined, size: 18),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            'Thiết bị do IT quản lý',
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium,
          ),
        ),
      ],
    ),
  );
}

class _AssetPlaceholder extends StatelessWidget {
  const _AssetPlaceholder();

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: const Center(child: Icon(Icons.devices_other_outlined, size: 40)),
  );
}

class _RecallReviewSheet extends StatelessWidget {
  const _RecallReviewSheet({
    required this.assetName,
    required this.assetCode,
    required this.reason,
  });

  final String assetName;
  final String? assetCode;
  final String reason;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Kiểm tra trước khi gửi',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 6),
          const Text(
            'Sau khi gửi, nội dung sẽ bị khóa cho đến khi được trả về.',
          ),
          const SizedBox(height: 16),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const CircleAvatar(child: Icon(Icons.swap_horiz)),
            title: Text(assetName),
            subtitle: assetCode?.isNotEmpty == true
                ? Text('Mã tài sản: $assetCode')
                : const Text('Tài sản cần đổi'),
          ),
          const Divider(height: 24),
          Text('Lý do', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          Text(reason),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: const Icon(Icons.send_outlined),
              label: const Text('Xác nhận gửi'),
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Quay lại chỉnh sửa'),
            ),
          ),
        ],
      ),
    ),
  );
}

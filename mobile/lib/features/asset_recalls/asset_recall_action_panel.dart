import 'package:flutter/material.dart';

import '../../core/widgets/required_reason_dialog.dart';
import 'asset_recall_dialogs.dart';
import 'asset_recalls_repository.dart';

/// Builds the first available action for the loaded recall request.
Widget? buildRecallActionPanel(
  BuildContext context, {
  required String requestId,
  required Object? requestType,
  required List<String> allowedActions,
  required bool acting,
  required VoidCallback onEdit,
  required Future<String?> Function() selectReplacement,
  required AssetRecallsRepository repository,
  required Future<void> Function(Future<void> Function()) run,
}) {
  if (acting) {
    return const Padding(
      padding: EdgeInsets.all(18),
      child: Center(child: CircularProgressIndicator()),
    );
  }

  if (allowedActions.contains('asset.recall.update')) {
    return _ActionPrompt(
      message: 'Cập nhật nội dung và gửi lại phiếu để bắt đầu vòng duyệt mới.',
      child: _SingleAction(label: 'Tiếp tục phiếu', onPressed: onEdit),
    );
  }

  if (allowedActions.contains('asset.recall.approve_department')) {
    return _ActionPrompt(
      message: 'Bạn cần duyệt nhu cầu trước khi chuyển phiếu đến Trưởng IT.',
      child: _DecisionActions(
        approveLabel: 'Duyệt & gửi IT',
        onApprove: () =>
            run(() => repository.decideDepartment(requestId, approved: true)),
        onReject: () async {
          final reason = await showRequiredReasonDialog(
            context,
            title: 'Trả phiếu về chỉnh sửa',
          );
          if (reason != null) {
            await run(
              () => repository.decideDepartment(
                requestId,
                approved: false,
                reason: reason,
              ),
            );
          }
        },
      ),
    );
  }

  if (allowedActions.contains('asset.recall.approve_it')) {
    final disposal = requestType == 'disposal';
    final upgrade = requestType == 'upgrade';

    return _ActionPrompt(
      message: disposal || upgrade
          ? 'Duyệt để chuyển sang bước xác nhận bàn giao vào kho IT.'
          : 'Chọn tài sản tương đương trong kho IT trước khi duyệt.',
      child: _DecisionActions(
        approveLabel: disposal
            ? 'Duyệt báo phế'
            : upgrade
            ? 'Duyệt nâng cấp'
            : 'Chọn tài sản & duyệt',
        onApprove: () async {
          if (disposal || upgrade) {
            await run(() => repository.decideIt(requestId, approved: true));
            return;
          }
          final replacementId = await selectReplacement();
          if (replacementId != null) {
            await run(
              () => repository.decideIt(
                requestId,
                approved: true,
                replacementAssetId: replacementId,
              ),
            );
          }
        },
        onReject: () async {
          final reason = await showRequiredReasonDialog(
            context,
            title: 'Trả phiếu về chỉnh sửa',
          );
          if (reason != null) {
            await run(
              () => repository.decideIt(
                requestId,
                approved: false,
                reason: reason,
              ),
            );
          }
        },
      ),
    );
  }

  if (allowedActions.contains('asset.recall.confirm_handover')) {
    final disposal = requestType == 'disposal';
    final upgrade = requestType == 'upgrade';

    return _ActionPrompt(
      message: disposal || upgrade
          ? 'Xác nhận sau khi tài sản đã được bàn giao thực tế cho kho IT.'
          : 'Xác nhận sau khi tài sản cũ và tài sản thay thế đã được bàn giao thực tế.',
      child: _DecisionActions(
        approveLabel: 'Xác nhận bàn giao',
        onApprove: () =>
            run(() => repository.decideHandover(requestId, confirmed: true)),
        onReject: () async {
          final reason = await showRequiredReasonDialog(
            context,
            title: 'Từ chối bàn giao',
          );
          if (reason != null) {
            await run(
              () => repository.decideHandover(
                requestId,
                confirmed: false,
                reason: reason,
              ),
            );
          }
        },
      ),
    );
  }

  if (allowedActions.contains('asset.recall.complete_disposal')) {
    return _ActionPrompt(
      message: 'Tài sản đang ở kho IT và chờ ghi nhận kết quả xử lý.',
      child: _SingleAction(
        label: 'Hoàn tất báo phế',
        onPressed: () async {
          final data = await showRecallDisposalDialog(context);
          if (data == null) return;
          await run(
            () => repository.completeDisposal(
              requestId,
              disposalDate: data.disposalDate,
              disposalMethod: data.disposalMethod,
              processingResult: data.processingResult,
              recoveryValue: data.recoveryValue,
            ),
          );
        },
      ),
    );
  }

  if (allowedActions.contains('asset.recall.process_upgrade')) {
    return _ActionPrompt(
      message: 'Tài sản đang ở kho IT và chờ ghi nhận kết quả nâng cấp.',
      child: _SingleAction(
        label: 'Hoàn tất nâng cấp',
        onPressed: () async {
          final result = await showRecallUpgradeResultDialog(context);
          if (result != null) {
            await run(
              () => repository.completeUpgrade(
                requestId,
                processingResult: result,
              ),
            );
          }
        },
      ),
    );
  }

  if (allowedActions.contains('asset.recall.confirm_upgrade_return')) {
    return _ActionPrompt(
      message: 'Kiểm tra tài sản đã nâng cấp trước khi xác nhận nhận lại.',
      child: _DecisionActions(
        approveLabel: 'Xác nhận nhận tài sản',
        onApprove: () => run(
          () => repository.decideUpgradeReturn(requestId, confirmed: true),
        ),
        onReject: () async {
          final reason = await showRequiredReasonDialog(
            context,
            title: 'Yêu cầu IT xử lý lại',
          );
          if (reason != null) {
            await run(
              () => repository.decideUpgradeReturn(
                requestId,
                confirmed: false,
                reason: reason,
              ),
            );
          }
        },
      ),
    );
  }

  return null;
}

class _ActionPrompt extends StatelessWidget {
  const _ActionPrompt({required this.message, required this.child});

  final String message;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, size: 20),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
      ),
      child,
    ],
  );
}

class _DecisionActions extends StatelessWidget {
  const _DecisionActions({
    required this.approveLabel,
    required this.onApprove,
    required this.onReject,
  });

  final String approveLabel;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: onReject,
            child: const Text('Trả lại'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton(onPressed: onApprove, child: Text(approveLabel)),
        ),
      ],
    ),
  );
}

class _SingleAction extends StatelessWidget {
  const _SingleAction({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: FilledButton(onPressed: onPressed, child: Text(label)),
  );
}

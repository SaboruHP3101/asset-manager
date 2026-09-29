import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'purchase_receipt_models.dart';
import 'purchase_receipts_repository.dart';

class PurchaseInspectionQueueScreen extends StatefulWidget {
  const PurchaseInspectionQueueScreen({super.key, this.repository});

  final PurchaseReceiptsRepository? repository;

  @override
  State<PurchaseInspectionQueueScreen> createState() =>
      _PurchaseInspectionQueueScreenState();
}

class _PurchaseInspectionQueueScreenState
    extends State<PurchaseInspectionQueueScreen> {
  late final PurchaseReceiptsRepository _repository;
  List<PurchaseInspectionUnit>? _units;
  String? _error;
  String? _actingUnitId;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PurchaseReceiptsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _units = null;
      _error = null;
    });
    try {
      final units = await _repository.findInspectionQueue();
      if (mounted) setState(() => _units = units);
    } catch (error) {
      if (mounted) setState(() => _error = purchaseReceiptApiError(error));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Hàng chờ kiểm tra'),
      actions: [
        IconButton(
          tooltip: 'Tải lại',
          onPressed: _units == null ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: _error != null
        ? _Message(message: _error!, onRetry: _load)
        : _units == null
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _load,
            child: _units!.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 140),
                      Icon(Icons.fact_check_outlined, size: 56),
                      SizedBox(height: 12),
                      Text(
                        'Không có đơn vị nào chờ kiểm tra.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _units!.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) => _unitCard(_units![index]),
                  ),
          ),
  );

  Widget _unitCard(PurchaseInspectionUnit unit) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(unit.itemName, style: Theme.of(context).textTheme.titleMedium),
          Text('${unit.purchaseOrderCode} • ${unit.receiptCode}'),
          Text(
            'Đơn vị #${unit.sequenceNumber}'
            '${unit.serialNumber == null ? '' : ' • Serial ${unit.serialNumber}'}',
          ),
          Text('Ngày giao ${unit.deliveryDate}'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _actingUnitId == null
                      ? () => _inspect(unit, accepted: false)
                      : null,
                  child: const Text('Không đạt'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: _actingUnitId == null
                      ? () => _inspect(unit, accepted: true)
                      : null,
                  child: _actingUnitId == unit.unitId
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Đạt'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );

  Future<void> _inspect(
    PurchaseInspectionUnit unit, {
    required bool accepted,
  }) async {
    final input = await showDialog<_InspectionInput>(
      context: context,
      builder: (_) => _InspectionDialog(accepted: accepted),
    );
    if (input == null) return;
    setState(() => _actingUnitId = unit.unitId);
    try {
      final result = await _repository.inspect(
        unitId: unit.unitId,
        accepted: accepted,
        reason: input.reason,
        note: input.note,
        evidence: input.evidence,
      );
      if (!mounted) return;
      setState(() {
        _actingUnitId = null;
        _units = _units!.where((item) => item.unitId != unit.unitId).toList();
      });
      await _showResult(result);
    } catch (error) {
      if (!mounted) return;
      setState(() => _actingUnitId = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(purchaseReceiptApiError(error))));
    }
  }

  Future<void> _showResult(PurchaseInspectionResult result) {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          result.inspectionResult == 'accepted'
              ? 'Đã xác nhận đạt'
              : 'Đã ghi nhận không đạt',
        ),
        content: result.assetCode == null
            ? const Text('Kết quả đã được lưu.')
            : SelectableText(
                'Mã tài sản: ${result.assetCode}\nQR: ${result.qrCode}',
              ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }
}

class _InspectionDialog extends StatefulWidget {
  const _InspectionDialog({required this.accepted});
  final bool accepted;

  @override
  State<_InspectionDialog> createState() => _InspectionDialogState();
}

class _InspectionDialogState extends State<_InspectionDialog> {
  final _reason = TextEditingController();
  final _note = TextEditingController();
  XFile? _evidence;

  @override
  void dispose() {
    _reason.dispose();
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.accepted ? 'Xác nhận đạt' : 'Ghi nhận không đạt'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!widget.accepted)
            TextField(
              controller: _reason,
              autofocus: true,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Lý do bắt buộc'),
            ),
          TextField(
            controller: _note,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Ghi chú'),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.add_photo_alternate_outlined),
            title: const Text('Ảnh bằng chứng'),
            subtitle: Text(_evidence?.name ?? 'Tùy chọn'),
            onTap: () async {
              final image = await ImagePicker().pickImage(
                source: ImageSource.gallery,
              );
              if (image != null) setState(() => _evidence = image);
            },
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Đóng'),
      ),
      FilledButton(
        onPressed: () {
          final reason = _reason.text.trim();
          if (!widget.accepted && reason.isEmpty) return;
          Navigator.pop(
            context,
            _InspectionInput(
              reason: reason.isEmpty ? null : reason,
              note: _note.text.trim(),
              evidence: _evidence,
            ),
          );
        },
        child: const Text('Xác nhận'),
      ),
    ],
  );
}

class _InspectionInput {
  const _InspectionInput({this.reason, this.note, this.evidence});
  final String? reason;
  final String? note;
  final XFile? evidence;
}

class _Message extends StatelessWidget {
  const _Message({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

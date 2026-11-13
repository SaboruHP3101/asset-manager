part of 'depreciation_screens.dart';

class DepreciationDetailScreen extends StatefulWidget {
  const DepreciationDetailScreen({
    super.key,
    required this.periodId,
    required this.profile,
    this.repository,
  });

  final String periodId;
  final AuthenticatedProfile profile;
  final DepreciationsRepository? repository;

  @override
  State<DepreciationDetailScreen> createState() =>
      _DepreciationDetailScreenState();
}

class _DepreciationDetailScreenState extends State<DepreciationDetailScreen> {
  late final _repository = widget.repository ?? DepreciationsRepository();
  DepreciationPeriod? _period;
  String? _employeeId;
  String? _earlierMonth;
  String? _error;
  String? _acting;
  bool _loading = true;

  bool get _canPrepare =>
      widget.profile.allows('depreciation.prepare') &&
      _period?.status == 'draft';
  bool get _canDecide =>
      widget.profile.allows('depreciation.approve') &&
      _period?.status == 'pending_approval' &&
      _employeeId != null &&
      _period?.submittedBy != _employeeId;

  @override
  void initState() {
    super.initState();
    if (widget.profile.allows('depreciation.view')) _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final periods = await _repository.findAll();
      final period = await _repository.findOne(widget.periodId);
      final employeeId = widget.profile.allows('depreciation.approve')
          ? await _repository.currentEmployeeId()
          : null;
      final earlier =
          periods
              .where(
                (item) =>
                    item.month.compareTo(period.month) < 0 &&
                    item.status != 'recorded',
              )
              .toList()
            ..sort((a, b) => a.month.compareTo(b.month));
      if (!mounted) return;
      setState(() {
        _period = period;
        _employeeId = employeeId;
        _earlierMonth = earlier.isEmpty ? null : earlier.first.monthLabel;
      });
    } catch (error) {
      if (mounted) setState(() => _error = depreciationError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _run(
    String label,
    Future<DepreciationPeriod> Function() action,
  ) async {
    if (_acting != null) return;
    setState(() => _acting = label);
    try {
      final updated = await action();
      if (!mounted) return;
      setState(() => _period = updated);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Đã $label.')));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(depreciationError(error))));
      await _load();
    } finally {
      if (mounted) setState(() => _acting = null);
    }
  }

  Future<void> _submit() async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => _SheetContent(
        children: [
          Text(
            'Trình duyệt tháng ${_period!.monthLabel}',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          Text(
            '${_period!.assetCount} tài sản · ${depreciationMoney(_period!.total)}',
          ),
          const Text(
            'Kỳ sẽ được khóa để Trưởng phòng Kế toán duyệt. Giá trị tài sản chỉ thay đổi sau khi duyệt.',
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xác nhận trình duyệt'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await _run('trình duyệt', () => _repository.submit(widget.periodId));
    }
  }

  Future<void> _decide({required bool approve}) async {
    var reason = '';
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => _SheetContent(
          children: [
            Text(
              approve ? 'Duyệt & ghi nhận' : 'Trả về chỉnh sửa',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            Text(
              'Tháng ${_period!.monthLabel} · ${depreciationMoney(_period!.total)}',
            ),
            if (approve)
              const Text(
                'Xác nhận ghi nhận khấu hao và cập nhật giá trị còn lại của tài sản. Kỳ đã ghi nhận không thể mở lại.',
              )
            else
              TextField(
                autofocus: true,
                minLines: 2,
                maxLines: 4,
                maxLength: 1000,
                decoration: textareaDecoration(
                  context,
                  const InputDecoration(labelText: 'Lý do trả về (bắt buộc)'),
                ),
                onChanged: (value) => setSheetState(() => reason = value),
              ),
            FilledButton(
              onPressed: !approve && reason.trim().isEmpty
                  ? null
                  : () => Navigator.pop(context, reason.trim()),
              child: Text(
                approve ? 'Xác nhận duyệt & ghi nhận' : 'Xác nhận trả về',
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Đóng'),
            ),
          ],
        ),
      ),
    );
    if (result != null && mounted) {
      await _run(
        approve ? 'duyệt và ghi nhận' : 'trả về chỉnh sửa',
        () => _repository.decide(
          widget.periodId,
          approve: approve,
          reason: approve ? null : result,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final period = _period;
    final busy = _acting != null || _loading;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          period == null
              ? 'Chi tiết khấu hao'
              : 'Khấu hao ${period.monthLabel}',
        ),
      ),
      body: !widget.profile.allows('depreciation.view')
          ? const Center(child: Text('Bạn không có quyền xem khấu hao.'))
          : _error != null
          ? _Retry(message: _error!, onRetry: _load)
          : period == null
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: RefreshIndicator(
                  onRefresh: () async {
                    if (!busy) await _load();
                  },
                  child: ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    itemCount: period.lines.length + period.history.length + 3,
                    itemBuilder: (context, index) {
                      if (index == 0) return _summary(period);
                      if (index == 1) return const _Heading('Tài sản trong kỳ');
                      final lineIndex = index - 2;
                      if (lineIndex < period.lines.length) {
                        return _asset(period.lines[lineIndex]);
                      }
                      if (lineIndex == period.lines.length) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (period.lines.isEmpty)
                              const Text(
                                'Không có tài sản trong bản tính này. Kiểm tra cấu hình tài sản và tính lại kỳ nháp nếu cần.',
                              ),
                            const _Heading('Lịch sử xử lý'),
                            if (period.history.isEmpty)
                              const Text('Chưa có lịch sử xử lý.'),
                          ],
                        );
                      }
                      final entry =
                          period.history[lineIndex - period.lines.length - 1];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${entry.label} · ${entry.actorName}'),
                        subtitle: Text(
                          '${depreciationTimestamp(entry.createdAt)}${entry.reason == null ? '' : '\n${entry.reason}'}',
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
      bottomNavigationBar:
          period == null || _error != null || (!_canPrepare && !_canDecide)
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_acting != null) ...[
                      const LinearProgressIndicator(),
                      Text('Đang $_acting...', semanticsLabel: 'Đang $_acting'),
                    ],
                    if (_canPrepare) ...[
                      OutlinedButton(
                        onPressed: busy || _earlierMonth != null
                            ? null
                            : () => _run(
                                'tính lại',
                                () => _repository.recalculate(widget.periodId),
                              ),
                        child: const Text('Tính lại'),
                      ),
                      FilledButton(
                        onPressed:
                            busy ||
                                _earlierMonth != null ||
                                period.calculatedAt == null
                            ? null
                            : _submit,
                        child: const Text('Trình duyệt'),
                      ),
                    ],
                    if (_canDecide) ...[
                      FilledButton(
                        onPressed: busy || _earlierMonth != null
                            ? null
                            : () => _decide(approve: true),
                        child: const Text('Duyệt & ghi nhận'),
                      ),
                      OutlinedButton(
                        onPressed: busy ? null : () => _decide(approve: false),
                        child: const Text('Trả về'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  Widget _summary(DepreciationPeriod period) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            period.statusLabel,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Text('${period.assetCount} tài sản'),
          Text('Tổng khấu hao: ${depreciationMoney(period.total)}'),
          Text(
            period.calculatedAt == null
                ? 'Chưa có bản tính. Chọn Tính lại trước khi trình duyệt.'
                : 'Tính lúc: ${depreciationTimestamp(period.calculatedAt!)}',
          ),
          if (period.returnReason != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                'Lý do trả về: ${period.returnReason}',
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          if (_earlierMonth != null && period.status != 'recorded')
            Text(
              'Cần ghi nhận kỳ $_earlierMonth trước khi tính, trình hoặc duyệt kỳ này.',
            ),
          if (period.status == 'pending_approval')
            const Text('Kỳ đang chờ duyệt. Bản tính đã khóa.'),
          if (period.status == 'recorded')
            const Text(
              'Khấu hao đã được ghi nhận và giá trị tài sản đã cập nhật.',
            ),
          if (period.status == 'pending_approval' &&
              widget.profile.allows('depreciation.approve') &&
              !_canDecide)
            Text(
              _employeeId == null
                  ? 'Không thể xác định người duyệt. Vui lòng đăng nhập lại.'
                  : 'Người gửi không được tự duyệt hoặc trả về kỳ khấu hao.',
            ),
        ],
      ),
    ),
  );

  Widget _asset(DepreciationLine line) => Card(
    child: ExpansionTile(
      title: Text('${line.assetCode} · ${line.name ?? 'Tài sản'}'),
      subtitle: Text('Khấu hao: ${depreciationMoney(line.amount)}'),
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      children: [
        Text('Nguyên giá: ${depreciationMoney(line.originalCost)}'),
        Text('Thời hạn: ${line.termMonths} tháng'),
        Text(
          'Từ ${depreciationDate(line.fromDate)} đến ${depreciationDate(line.toDate)}',
        ),
        Text('Đầu kỳ: ${depreciationMoney(line.openingValue)}'),
        Text('Cuối kỳ: ${depreciationMoney(line.remainingValue)}'),
      ],
    ),
  );
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Text(text, style: Theme.of(context).textTheme.titleMedium),
  );
}

class _Retry extends StatelessWidget {
  const _Retry({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    ),
  );
}

class _SheetContent extends StatelessWidget {
  const _SheetContent({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: children,
      ),
    ),
  );
}

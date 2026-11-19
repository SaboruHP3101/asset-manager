import 'package:flutter/material.dart';

import '../../core/auth/auth_session.dart';
import '../../core/theme/textarea_decoration.dart';
import 'depreciation_models.dart';
import 'depreciations_repository.dart';

part 'depreciation_detail_screen.dart';

class DepreciationPeriodsScreen extends StatefulWidget {
  const DepreciationPeriodsScreen({
    super.key,
    required this.profile,
    this.repository,
  });

  final AuthenticatedProfile profile;
  final DepreciationsRepository? repository;

  @override
  State<DepreciationPeriodsScreen> createState() =>
      _DepreciationPeriodsScreenState();
}

class _DepreciationPeriodsScreenState extends State<DepreciationPeriodsScreen> {
  late final _repository = widget.repository ?? DepreciationsRepository();
  List<DepreciationPeriod>? _periods;
  String? _error;
  bool _loading = false;
  bool _generating = false;

  @override
  void initState() {
    super.initState();
    if (widget.profile.allows('depreciation.view')) _load();
  }

  Future<void> _load() async {
    if (_generating) return;
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final periods = await _repository.findAll();
      if (mounted) setState(() => _periods = periods);
    } catch (error) {
      if (mounted) setState(() => _error = depreciationError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _generate() async {
    if (_generating || _loading) return;
    setState(() => _generating = true);
    try {
      final periods = await _repository.generateDuePeriods();
      if (!mounted) return;
      setState(() {
        _periods = periods;
        _error = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã kiểm tra và bổ sung các kỳ nháp đến hạn.'),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(depreciationError(error))));
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _open(DepreciationPeriod period) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => DepreciationDetailScreen(
          periodId: period.id,
          profile: widget.profile,
          repository: _repository,
        ),
      ),
    );
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Khấu hao')),
    bottomNavigationBar: widget.profile.allows('depreciation.view')
        ? SafeArea(
            minimum: const EdgeInsets.all(16),
            child: FilledButton.icon(
              onPressed: _loading || _generating ? null : _generate,
              icon: const Icon(Icons.playlist_add),
              label: Text(
                _generating ? 'Đang tạo kỳ nháp...' : 'Tạo kỳ nháp đến hạn',
              ),
            ),
          )
        : null,
    body: !widget.profile.allows('depreciation.view')
        ? const Center(child: Text('Bạn không có quyền xem khấu hao.'))
        : _error != null
        ? _Retry(message: _error!, onRetry: _load)
        : _periods == null
        ? const Center(child: CircularProgressIndicator())
        : Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: RefreshIndicator(
                onRefresh: _load,
                child: ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: _periods!.isEmpty ? 1 : _periods!.length,
                  itemBuilder: (context, index) {
                    if (_periods!.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 64),
                        child: Text(
                          'Chưa có kỳ khấu hao. Kỳ nháp sẽ được tạo tự động sau khi '
                          'kết thúc tháng và đã thiết lập tháng bắt đầu quản lý.',
                          textAlign: TextAlign.center,
                        ),
                      );
                    }
                    final period = _periods![index];
                    return Card(
                      child: ListTile(
                        title: Text('Tháng ${period.monthLabel}'),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              period.statusLabel,
                              style: TextStyle(
                                color: period.status == 'pending_approval'
                                    ? Theme.of(context).colorScheme.primary
                                    : null,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text('${period.assetCount} tài sản'),
                            Text(depreciationMoney(period.total)),
                          ],
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _open(period),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
  );
}

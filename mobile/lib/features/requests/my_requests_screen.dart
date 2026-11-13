import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/utils/display_date.dart';
import '../../core/widgets/status_chip.dart';
import '../asset_recalls/asset_recall_detail_screen.dart';
import '../purchase_requests/purchase_request_detail_screen.dart';
import '../repair_requests/repair_progress_screen.dart';

import 'my_requests_data.dart';
import 'my_requests_repository.dart';
import 'request_filter_sheet.dart';

export 'my_requests_data.dart';

class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key, this.loader});

  final MyRequestsLoader? loader;

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  final _searchController = TextEditingController();
  List<MyRequestItem>? _mine;
  List<MyRequestItem>? _queue;
  Set<MyRequestType> _types = {};
  Set<String> _statuses = {};
  bool _newestFirst = true;
  String? _error;

  List<MyRequestItem> _visibleItems(
    List<MyRequestItem>? source, {
    required bool employeeView,
  }) {
    final query = _searchController.text.trim().toLowerCase();
    final items = (source ?? const <MyRequestItem>[]).where((item) {
      final matchesSearch =
          query.isEmpty ||
          item.title.toLowerCase().contains(query) ||
          item.reference.toLowerCase().contains(query) ||
          item.type.label.toLowerCase().contains(query) ||
          _statusLabel(
            item,
            employeeView: employeeView,
          ).toLowerCase().contains(query);
      final matchesType = _types.isEmpty || _types.contains(item.type);
      final matchesStatus =
          _statuses.isEmpty ||
          _statuses.contains(_statusLabel(item, employeeView: employeeView));
      return matchesSearch && matchesType && matchesStatus;
    }).toList();

    items.sort(
      (left, right) => _newestFirst
          ? right.updatedAt.compareTo(left.updatedAt)
          : left.updatedAt.compareTo(right.updatedAt),
    );
    return items;
  }

  int get _filterCount => _types.length + _statuses.length;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _mine = null;
      _queue = null;
      _error = null;
    });
    try {
      final data =
          await (widget.loader?.call() ?? MyRequestsRepository().load());
      if (mounted) {
        setState(() {
          _mine = data.mine;
          _queue = data.queue;
        });
      }
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.response?.statusCode == 401
            ? 'Phiên đăng nhập đã hết hạn.'
            : 'Không thể tải danh sách đơn yêu cầu.';
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Không thể tải danh sách đơn yêu cầu.');
      }
    }
  }

  Future<void> _open(MyRequestItem item) async {
    final screen = switch (item.type) {
      MyRequestType.repair => RepairProgressScreen(requestId: item.id),
      MyRequestType.purchase => PurchaseRequestDetailScreen(requestId: item.id),
      _ => AssetRecallDetailScreen(requestId: item.id),
    };
    await Navigator.of(context)
        .push<void>(MaterialPageRoute(builder: (_) => screen));
    await _load();
  }

  Future<void> _openFilters() async {
    final items = [...?_mine, ...?_queue];
    final result = await showModalBottomSheet<RequestFilters>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => RequestFilterSheet(
        availableTypes: items.map((item) => item.type).toSet(),
        availableStatuses: {
          for (final item in _mine ?? const <MyRequestItem>[])
            _statusLabel(item, employeeView: true),
          for (final item in _queue ?? const <MyRequestItem>[])
            _statusLabel(item, employeeView: false),
        },
        initialTypes: _types,
        initialStatuses: _statuses,
        newestFirst: _newestFirst,
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      _types = result.types;
      _statuses = result.statuses;
      _newestFirst = result.newestFirst;
    });
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Đơn yêu cầu'),
          centerTitle: true,
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Của tôi'),
              Tab(text: 'Chờ xử lý'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildTab(_mine, employeeView: true),
            _buildTab(_queue, employeeView: false),
          ],
        ),
      ),
    );
  }

  Widget _buildTab(List<MyRequestItem>? source, {required bool employeeView}) {
    final items = _visibleItems(source, employeeView: employeeView);
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: _searchController,
                      enabled: source != null,
                      decoration: InputDecoration(
                        hintText: 'Tìm theo tên, mã hoặc loại yêu cầu',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: _searchController.text.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Xóa tìm kiếm',
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {});
                                },
                                icon: const Icon(Icons.clear),
                              ),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                for (final type in _types)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: InputChip(
                                      label: Text(type.label),
                                      onDeleted: () =>
                                          setState(() => _types.remove(type)),
                                    ),
                                  ),
                                for (final status in _statuses)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: InputChip(
                                      label: Text(status),
                                      onDeleted: () => setState(
                                        () => _statuses.remove(status),
                                      ),
                                    ),
                                  ),
                                if (_filterCount == 0)
                                  Text(
                                    _newestFirst ? 'Mới nhất' : 'Cũ nhất',
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall,
                                  ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Badge(
                          isLabelVisible: _filterCount > 0,
                          label: Text('$_filterCount'),
                          child: OutlinedButton.icon(
                            onPressed: source == null ? null : _openFilters,
                            icon: const Icon(Icons.tune),
                            label: const Text('Bộ lọc'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (source == null && _error == null)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _RequestMessage(
                  icon: Icons.cloud_off_outlined,
                  title: 'Không thể tải đơn yêu cầu',
                  message: _error!,
                  onRetry: _load,
                ),
              )
            else if (items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _RequestMessage(
                  icon: Icons.assignment_outlined,
                  title: source!.isEmpty
                      ? employeeView
                            ? 'Chưa có đơn yêu cầu'
                            : 'Không có đơn chờ xử lý'
                      : 'Chưa có đơn phù hợp',
                  message: source.isEmpty
                      ? employeeView
                            ? 'Các đơn bạn tạo sẽ xuất hiện tại đây.'
                            : 'Bạn hiện không có công việc cần xử lý.'
                      : 'Thử thay đổi từ khóa hoặc bộ lọc.',
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList.separated(
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) => _RequestCard(
                    item: items[index],
                    employeeView: employeeView,
                    onTap: () => _open(items[index]),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.item,
    required this.employeeView,
    required this.onTap,
  });

  final MyRequestItem item;
  final bool employeeView;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(child: Icon(item.type.icon)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text('${item.type.label} • ${item.reference}'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _RequestStatusChip(
                        label: _statusLabel(item, employeeView: employeeView),
                      ),
                      Text(
                        formatDisplayDate(item.updatedAt),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    ),
  );
}

class _RequestStatusChip extends StatelessWidget {
  const _RequestStatusChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final isProblem =
        label == 'Cần chỉnh sửa' || label == 'Đã từ chối' || label == 'Đã hủy';
    final isDone =
        label == 'Hoàn tất' ||
        label == 'Đã duyệt' ||
        label == 'Đã xác nhận' ||
        label == 'Đã bàn giao';
    return StatusChip(
      icon: isProblem
          ? Icons.error_outline
          : isDone
          ? Icons.check_circle_outline
          : Icons.info_outline,
      label: label,
      compact: true,
      backgroundColor: isProblem
          ? colors.errorContainer
          : isDone
          ? colors.primaryContainer
          : colors.secondaryContainer,
      foregroundColor: isProblem
          ? colors.onErrorContainer
          : isDone
          ? colors.onPrimaryContainer
          : colors.onSecondaryContainer,
    );
  }
}

class _RequestMessage extends StatelessWidget {
  const _RequestMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.onRetry,
  });

  final IconData icon;
  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 52),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ],
      ),
    ),
  );
}

String _statusLabel(MyRequestItem item, {required bool employeeView}) {
  if (employeeView &&
      item.type == MyRequestType.disposal &&
      item.status == 'in_progress') {
    return 'Đã bàn giao';
  }
  if (item.type == MyRequestType.upgrade && item.status == 'in_progress') {
    return 'Đang nâng cấp';
  }
  if (item.type == MyRequestType.repair && item.status == 'in_progress') {
    return 'Đang sửa chữa';
  }
  return switch (item.status) {
    'draft' => 'Bản nháp',
    'pending_department_head' => 'Chờ Trưởng bộ phận',
    'pending_procurement_enrichment' => 'Chờ Thu mua bổ sung',
    'pending_procurement_head' => 'Chờ Trưởng Thu mua',
    'pending_it_head' => 'Chờ Trưởng IT',
    'pending_handover_confirmations' => 'Chờ bàn giao',
    'ready_for_return' => 'Chờ nhận lại',
    'revision_required' => 'Cần chỉnh sửa',
    'approved' => 'Đã duyệt',
    'completed' || 'closed' => 'Hoàn tất',
    'confirmed' => 'Đã xác nhận',
    'rejected' => 'Đã từ chối',
    'cancelled' => 'Đã hủy',
    'ordering' => 'Đang đặt mua',
    _ => 'Đang xử lý',
  };
}

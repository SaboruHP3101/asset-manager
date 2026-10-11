import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../asset_recalls/asset_recall_detail_screen.dart';
import '../purchase_requests/purchase_request_detail_screen.dart';
import '../repair_requests/repair_progress_screen.dart';

typedef MyRequestsLoader = Future<MyRequestsData> Function();

enum MyRequestType {
  repair('Sửa chữa', Icons.build_outlined),
  exchange('Đổi tài sản', Icons.swap_horiz),
  upgrade('Nâng cấp', Icons.upgrade),
  disposal('Báo phế', Icons.delete_outline),
  purchase('Đề nghị mua', Icons.shopping_cart_outlined);

  const MyRequestType(this.label, this.icon);

  final String label;
  final IconData icon;
}

class MyRequestItem {
  const MyRequestItem({
    required this.id,
    required this.type,
    required this.title,
    required this.reference,
    required this.status,
    required this.updatedAt,
  });

  final String id;
  final MyRequestType type;
  final String title;
  final String reference;
  final String status;
  final DateTime updatedAt;
}

class MyRequestsData {
  const MyRequestsData({required this.mine, required this.queue});

  final List<MyRequestItem> mine;
  final List<MyRequestItem> queue;
}

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

  Future<MyRequestsData> _loadFromApi() async {
    final responses = await Future.wait([
      ApiClient.instance.dio.get<List<dynamic>>('/repair-requests/mine'),
      ApiClient.instance.dio.get<List<dynamic>>('/asset-recall-requests/mine'),
      ApiClient.instance.dio.get<List<dynamic>>('/purchase-requests/mine'),
      ApiClient.instance.dio.get<List<dynamic>>('/repair-requests/queue'),
      ApiClient.instance.dio.get<List<dynamic>>('/asset-recall-requests/queue'),
      ApiClient.instance.dio.get<List<dynamic>>('/purchase-requests/queue'),
    ]);

    return MyRequestsData(
      mine: _mapResponses(responses, 0),
      queue: _mapResponses(responses, 3),
    );
  }

  List<MyRequestItem> _mapResponses(
    List<Response<List<dynamic>>> responses,
    int offset,
  ) => [
    for (final raw in responses[offset].data ?? const [])
      _repairItem(Map<String, dynamic>.from(raw as Map)),
    for (final raw in responses[offset + 1].data ?? const [])
      _recallItem(Map<String, dynamic>.from(raw as Map)),
    for (final raw in responses[offset + 2].data ?? const [])
      _purchaseItem(Map<String, dynamic>.from(raw as Map)),
  ];

  Future<void> _load() async {
    setState(() {
      _mine = null;
      _queue = null;
      _error = null;
    });
    try {
      final data = await (widget.loader?.call() ?? _loadFromApi());
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
    final result = await showModalBottomSheet<_RequestFilters>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _RequestFilterSheet(
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
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        filled: true,
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
                        _formatDate(item.updatedAt),
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
    return Chip(
      visualDensity: VisualDensity.compact,
      backgroundColor: isProblem
          ? colors.errorContainer
          : isDone
          ? colors.primaryContainer
          : colors.secondaryContainer,
      label: Text(label),
    );
  }
}

class _RequestFilters {
  const _RequestFilters({
    required this.types,
    required this.statuses,
    required this.newestFirst,
  });

  final Set<MyRequestType> types;
  final Set<String> statuses;
  final bool newestFirst;
}

class _RequestFilterSheet extends StatefulWidget {
  const _RequestFilterSheet({
    required this.availableTypes,
    required this.availableStatuses,
    required this.initialTypes,
    required this.initialStatuses,
    required this.newestFirst,
  });

  final Set<MyRequestType> availableTypes;
  final Set<String> availableStatuses;
  final Set<MyRequestType> initialTypes;
  final Set<String> initialStatuses;
  final bool newestFirst;

  @override
  State<_RequestFilterSheet> createState() => _RequestFilterSheetState();
}

class _RequestFilterSheetState extends State<_RequestFilterSheet> {
  late Set<MyRequestType> _types;
  late Set<String> _statuses;
  late bool _newestFirst;

  @override
  void initState() {
    super.initState();
    _types = {...widget.initialTypes};
    _statuses = {...widget.initialStatuses};
    _newestFirst = widget.newestFirst;
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bộ lọc', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          Text('Loại yêu cầu', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final type in MyRequestType.values)
                if (widget.availableTypes.contains(type))
                  FilterChip(
                    label: Text(type.label),
                    selected: _types.contains(type),
                    onSelected: (selected) => setState(
                      () => selected ? _types.add(type) : _types.remove(type),
                    ),
                  ),
            ],
          ),
          const SizedBox(height: 16),
          Text('Trạng thái', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final status in widget.availableStatuses)
                FilterChip(
                  label: Text(status),
                  selected: _statuses.contains(status),
                  onSelected: (selected) => setState(
                    () => selected
                        ? _statuses.add(status)
                        : _statuses.remove(status),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: true, label: Text('Mới nhất')),
              ButtonSegment(value: false, label: Text('Cũ nhất')),
            ],
            selected: {_newestFirst},
            onSelectionChanged: (value) =>
                setState(() => _newestFirst = value.first),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() {
                    _types.clear();
                    _statuses.clear();
                    _newestFirst = true;
                  }),
                  child: const Text('Đặt lại'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.pop(
                    context,
                    _RequestFilters(
                      types: _types,
                      statuses: _statuses,
                      newestFirst: _newestFirst,
                    ),
                  ),
                  child: const Text('Áp dụng'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
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

MyRequestItem _repairItem(Map<String, dynamic> json) => MyRequestItem(
  id: json['id'] as String,
  type: MyRequestType.repair,
  title: json['assetName'] as String? ?? 'Tài sản cần sửa chữa',
  reference: json['assetCode'] as String? ?? 'Chưa có mã tài sản',
  status: json['status'] as String? ?? '',
  updatedAt: _parseDate(json['createdAt'] ?? json['reportDate']),
);

MyRequestItem _recallItem(Map<String, dynamic> json) => MyRequestItem(
  id: json['id'] as String,
  type: switch (json['type']) {
    'upgrade' => MyRequestType.upgrade,
    'disposal' => MyRequestType.disposal,
    _ => MyRequestType.exchange,
  },
  title: json['assetName'] as String? ?? 'Tài sản',
  reference: json['assetCode'] as String? ?? 'Chưa có mã tài sản',
  status: json['status'] as String? ?? '',
  updatedAt: _parseDate(json['updatedAt'] ?? json['createdAt']),
);

MyRequestItem _purchaseItem(Map<String, dynamic> json) => MyRequestItem(
  id: json['id'] as String,
  type: MyRequestType.purchase,
  title: 'Đề nghị mua',
  reference: json['requestCode'] as String? ?? 'Chưa có mã phiếu',
  status: json['status'] as String? ?? '',
  updatedAt: _parseDate(json['updatedAt']),
);

DateTime _parseDate(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '') ?? DateTime(1970);

String _formatDate(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/'
    '${value.month.toString().padLeft(2, '0')}/${value.year}';

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

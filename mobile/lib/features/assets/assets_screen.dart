import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../../core/utils/department_labels.dart';
import '../login/login_screen.dart';
import 'asset_detail_screen.dart';
import 'asset_status_chip.dart';

class AssetsScreen extends StatefulWidget {
  const AssetsScreen({super.key, this.initiallyOpenScanner = false});

  final bool initiallyOpenScanner;

  @override
  State<AssetsScreen> createState() => _AssetsScreenState();
}

class _AssetsScreenState extends State<AssetsScreen> {
  final _tokenStorage = TokenStorage.instance;
  final _dio = ApiClient.instance.dio;
  final _searchController = TextEditingController();

  List<Map<String, dynamic>> _assets = [];
  List<Map<String, dynamic>> _categories = [];
  Set<String> _statuses = {};
  String? _categoryId;
  String _sort = 'name_asc';
  String? _error;
  bool _loading = true;

  List<Map<String, dynamic>> get _visibleAssets => _statuses.isEmpty
      ? _assets
      : _assets
            .where(
              (asset) => _statuses.contains(
                assetStatusFilterKey(asset['status'] as String? ?? ''),
              ),
            )
            .toList();

  String? get _categoryName {
    for (final category in _categories) {
      if (category['id'] == _categoryId) return category['name'] as String?;
    }

    return null;
  }

  int get _filterCount => (_categoryId == null ? 0 : 1) + _statuses.length;

  @override
  void initState() {
    super.initState();
    if (widget.initiallyOpenScanner) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        await _loadData();
        if (mounted) await _scanQr();
      });
    } else {
      _loadData();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final categoryResponse = await _dio.get<List<dynamic>>(
        '/assets/mine/categories',
      );
      _categories = (categoryResponse.data ?? []).cast<Map<String, dynamic>>();
      await _loadAssets(showLoading: false);
    } on DioException catch (error) {
      await _handleError(error);
    }
  }

  Future<List<Map<String, dynamic>>?> _loadAssets({
    bool showLoading = true,
  }) async {
    if (showLoading) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final query = <String, dynamic>{'sort': _sort};
      if (_searchController.text.trim().isNotEmpty) {
        query['search'] = _searchController.text.trim();
      }
      if (_categoryId != null) query['categoryId'] = _categoryId;

      final response = await _dio.get<List<dynamic>>(
        '/assets/mine',
        queryParameters: query,
      );
      final assets = (response.data ?? []).cast<Map<String, dynamic>>();
      if (!mounted) return null;
      setState(() {
        _assets = assets;
        _loading = false;
      });

      return assets;
    } on DioException catch (error) {
      await _handleError(error);
      return null;
    }
  }

  Future<void> _openFilters() async {
    final result = await showModalBottomSheet<_AssetFilters>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _AssetFilterSheet(
        categories: _categories,
        assets: _assets,
        initialCategoryId: _categoryId,
        initialStatuses: _statuses,
        initialSort: _sort,
      ),
    );
    if (result == null || !mounted) return;

    setState(() {
      _categoryId = result.categoryId;
      _statuses = result.statuses;
      _sort = result.sort;
    });
    await _loadAssets();
  }

  Future<void> _clearFilters() async {
    setState(() {
      _categoryId = null;
      _statuses = {};
    });
    await _loadAssets();
  }

  Future<void> _clearSearch() async {
    _searchController.clear();
    setState(() {});
    await _loadAssets();
  }

  Future<void> _scanQr() async {
    final qrCode = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _AssetQrScannerScreen()),
    );
    if (qrCode == null || !mounted) return;

    _searchController.clear();
    setState(() {
      _categoryId = null;
      _statuses = {};
    });
    final assets = await _loadAssets();
    if (!mounted || assets == null) return;

    final matches = assets.where((asset) => asset['qrCode'] == qrCode);
    if (matches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mã QR không thuộc tài sản của bạn.')),
      );
      return;
    }
    await _openDetail(matches.first);
  }

  Future<void> _openDetail(Map<String, dynamic> asset) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => AssetDetailScreen(assetId: asset['id'] as String),
      ),
    );
    await _loadAssets(showLoading: false);
  }

  Future<void> _handleError(DioException error) async {
    if (error.response?.statusCode == 401) {
      await _tokenStorage.clearAccessToken();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (_) => false,
      );
      return;
    }

    if (mounted) {
      setState(() {
        _loading = false;
        _error = 'Không thể tải danh sách tài sản.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final visibleAssets = _visibleAssets;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tài sản của tôi'),
        centerTitle: true,
        actions: [
          IconButton(
            onPressed: _loading ? null : _scanQr,
            tooltip: 'Quét mã QR',
            icon: const Icon(Icons.qr_code_scanner),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _loading
                            ? 'Đang cập nhật tài sản…'
                            : 'Bạn đang quản lý ${visibleAssets.length} tài sản',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _searchController,
                        enabled: !_loading,
                        textInputAction: TextInputAction.search,
                        decoration: InputDecoration(
                          hintText: 'Tìm theo tên tài sản',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: _searchController.text.isEmpty
                              ? null
                              : IconButton(
                                  onPressed: _loading ? null : _clearSearch,
                                  tooltip: 'Xóa tìm kiếm',
                                  icon: const Icon(Icons.clear),
                                ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                          filled: true,
                        ),
                        onChanged: (_) => setState(() {}),
                        onSubmitted: (_) => _loadAssets(),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: [
                                  if (_categoryName != null)
                                    Padding(
                                      padding: const EdgeInsets.only(right: 8),
                                      child: InputChip(
                                        label: Text(_categoryName!),
                                        avatar: const Icon(
                                          Icons.category_outlined,
                                          size: 18,
                                        ),
                                        onDeleted: _loading
                                            ? null
                                            : () async {
                                                setState(
                                                  () => _categoryId = null,
                                                );
                                                await _loadAssets();
                                              },
                                      ),
                                    ),
                                  for (final status in _statuses)
                                    Padding(
                                      padding: const EdgeInsets.only(right: 8),
                                      child: InputChip(
                                        label: Text(assetStatusLabel(status)),
                                        onDeleted: _loading
                                            ? null
                                            : () => setState(
                                                () => _statuses.remove(status),
                                              ),
                                      ),
                                    ),
                                  if (_filterCount == 0)
                                    Text(
                                      _sort == 'name_asc'
                                          ? 'Tên A–Z'
                                          : 'Tên Z–A',
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
                              onPressed: _loading ? null : _openFilters,
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
              if (_loading)
                const SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverToBoxAdapter(child: _AssetListSkeleton()),
                )
              else if (_error != null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _AssetMessageState(
                    icon: Icons.cloud_off_outlined,
                    title: 'Không thể tải tài sản',
                    message: _error!,
                    buttonText: 'Thử lại',
                    onPressed: _loadData,
                  ),
                )
              else if (visibleAssets.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _AssetMessageState(
                    icon: Icons.inventory_2_outlined,
                    title: 'Chưa có tài sản phù hợp',
                    message: _searchController.text.isEmpty && _filterCount == 0
                        ? 'Khi tài sản được cấp phát, chúng sẽ xuất hiện tại đây.'
                        : 'Hãy thử từ khóa hoặc bộ lọc khác.',
                    buttonText: _filterCount > 0 ? 'Xóa bộ lọc' : null,
                    onPressed: _filterCount > 0 ? _clearFilters : null,
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverList.separated(
                    itemCount: visibleAssets.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final asset = visibleAssets[index];
                      return AssetCard(
                        asset: asset,
                        onTap: () => _openDetail(asset),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class AssetCard extends StatelessWidget {
  const AssetCard({required this.asset, required this.onTap, super.key});

  final Map<String, dynamic> asset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final rawImageUrl = asset['imageUrl'] as String?;
    final imageUrl = rawImageUrl == null
        ? null
        : AppConfig.absoluteUrl(rawImageUrl);
    final assetId = asset['id'] as String;

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              Hero(
                tag: 'asset-image-$assetId',
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox.square(
                    dimension: 88,
                    child: _AssetImage(imageUrl: imageUrl, iconSize: 34),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      asset['name'] as String? ?? 'Tài sản',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      asset['assetCode'] as String? ?? 'Chưa có mã tài sản',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 9),
                    AssetStatusChip(
                      status: asset['status'] as String? ?? '',
                      compact: true,
                    ),
                    const SizedBox(height: 7),
                    Row(
                      children: [
                        Icon(
                          Icons.apartment_outlined,
                          size: 16,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            departmentLabel(asset['department'] as String?) ??
                                'Chưa có phòng ban',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
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
}

class _AssetImage extends StatelessWidget {
  const _AssetImage({required this.imageUrl, required this.iconSize});

  final String? imageUrl;
  final double iconSize;

  @override
  Widget build(BuildContext context) => imageUrl == null
      ? _placeholder(context, Icons.inventory_2_outlined)
      : Image.network(
          imageUrl!,
          fit: BoxFit.cover,
          frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
            if (wasSynchronouslyLoaded) return child;

            return AnimatedOpacity(
              opacity: frame == null ? 0 : 1,
              duration: const Duration(milliseconds: 220),
              child: child,
            );
          },
          errorBuilder: (_, _, _) =>
              _placeholder(context, Icons.broken_image_outlined),
        );

  Widget _placeholder(BuildContext context, IconData icon) => ColoredBox(
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: Center(child: Icon(icon, size: iconSize)),
  );
}

class _AssetFilterSheet extends StatefulWidget {
  const _AssetFilterSheet({
    required this.categories,
    required this.assets,
    required this.initialCategoryId,
    required this.initialStatuses,
    required this.initialSort,
  });

  final List<Map<String, dynamic>> categories;
  final List<Map<String, dynamic>> assets;
  final String? initialCategoryId;
  final Set<String> initialStatuses;
  final String initialSort;

  @override
  State<_AssetFilterSheet> createState() => _AssetFilterSheetState();
}

class _AssetFilterSheetState extends State<_AssetFilterSheet> {
  late String? _categoryId = widget.initialCategoryId;
  late Set<String> _statuses = {...widget.initialStatuses};
  late String _sort = widget.initialSort;

  List<String> get _availableStatuses => {
    ...widget.assets.map(
      (asset) => assetStatusFilterKey(asset['status'] as String? ?? ''),
    ),
    ..._statuses,
  }.where((status) => status.isNotEmpty).toList();

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bộ lọc tài sản',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<String?>(
              initialValue: _categoryId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Danh mục',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(
                  value: null,
                  child: Text('Tất cả danh mục'),
                ),
                ...widget.categories.map(
                  (category) => DropdownMenuItem(
                    value: category['id'] as String,
                    child: Text(category['name'] as String),
                  ),
                ),
              ],
              onChanged: (value) => setState(() => _categoryId = value),
            ),
            if (_availableStatuses.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Trạng thái',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final status in _availableStatuses)
                    FilterChip(
                      label: Text(assetStatusLabel(status)),
                      selected: _statuses.contains(status),
                      onSelected: (selected) => setState(() {
                        selected
                            ? _statuses.add(status)
                            : _statuses.remove(status);
                      }),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            Text('Sắp xếp', style: Theme.of(context).textTheme.titleMedium),
            RadioGroup<String>(
              groupValue: _sort,
              onChanged: (value) => setState(() => _sort = value!),
              child: const Column(
                children: [
                  RadioListTile(
                    contentPadding: EdgeInsets.zero,
                    value: 'name_asc',
                    title: Text('Tên A–Z'),
                  ),
                  RadioListTile(
                    contentPadding: EdgeInsets.zero,
                    value: 'name_desc',
                    title: Text('Tên Z–A'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() {
                      _categoryId = null;
                      _statuses = {};
                      _sort = 'name_asc';
                    }),
                    child: const Text('Đặt lại'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(
                      context,
                      _AssetFilters(
                        categoryId: _categoryId,
                        statuses: _statuses,
                        sort: _sort,
                      ),
                    ),
                    child: const Text('Áp dụng bộ lọc'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class _AssetFilters {
  const _AssetFilters({
    required this.categoryId,
    required this.statuses,
    required this.sort,
  });

  final String? categoryId;
  final Set<String> statuses;
  final String sort;
}

class _AssetListSkeleton extends StatelessWidget {
  const _AssetListSkeleton();

  @override
  Widget build(BuildContext context) => Column(
    children: List.generate(
      3,
      (_) => Container(
        height: 112,
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    ),
  );
}

class _AssetMessageState extends StatelessWidget {
  const _AssetMessageState({
    required this.icon,
    required this.title,
    required this.message,
    this.buttonText,
    this.onPressed,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? buttonText;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 54, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 14),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center),
          if (buttonText != null) ...[
            const SizedBox(height: 14),
            OutlinedButton(onPressed: onPressed, child: Text(buttonText!)),
          ],
        ],
      ),
    ),
  );
}

class _AssetQrScannerScreen extends StatefulWidget {
  const _AssetQrScannerScreen();

  @override
  State<_AssetQrScannerScreen> createState() => _AssetQrScannerScreenState();
}

class _AssetQrScannerScreenState extends State<_AssetQrScannerScreen> {
  bool _found = false;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Quét mã QR tài sản')),
    body: MobileScanner(
      onDetect: (capture) {
        if (_found || capture.barcodes.isEmpty) return;
        final value = capture.barcodes.first.rawValue;
        if (value == null) return;
        _found = true;
        Navigator.pop(context, value);
      },
    ),
  );
}

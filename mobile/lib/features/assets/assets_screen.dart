import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/department_labels.dart';
import '../../core/storage/token_storage.dart';
import '../login/login_screen.dart';
import 'asset_detail_screen.dart';

class AssetsScreen extends StatefulWidget {
  const AssetsScreen({super.key});

  @override
  State<AssetsScreen> createState() => _AssetsScreenState();
}

class _AssetsScreenState extends State<AssetsScreen> {
  final _tokenStorage = TokenStorage.instance;
  final _dio = ApiClient.instance.dio;
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _assets = [];
  List<Map<String, dynamic>> _categories = [];
  final List<String> _recentSearches = [];
  String? _categoryId;
  String _sort = 'name_asc';
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    // Tải danh mục và tài sản khi mở màn hình
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Tải danh mục lá và danh sách tài sản của nhân viên
  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final categoryResponse = await _dio.get<List<dynamic>>(
        '/assets/mine/categories',
      );
      // Backend đã giới hạn danh mục cha theo tài sản của nhân viên, tránh các
      // lựa chọn filter không thể trả kết quả.
      _categories = (categoryResponse.data ?? []).cast<Map<String, dynamic>>();
      await _loadAssets(showLoading: false);
    } on DioException catch (error) {
      await _handleError(error);
    }
  }

  // Gọi API với nội dung tìm kiếm, danh mục và cách sắp xếp
  Future<void> _loadAssets({bool showLoading = true}) async {
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
      if (!mounted) return;
      setState(() {
        _assets = (response.data ?? []).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } on DioException catch (error) {
      await _handleError(error);
    }
  }

  // Mở màn hình tìm kiếm và lưu tối đa ba từ khóa gần nhất
  Future<void> _openSearch() async {
    final search = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => _AssetSearchScreen(
          recentSearches: _recentSearches,
          initialSearch: _searchController.text,
        ),
      ),
    );

    if (search == null || !mounted) return;
    setState(() {
      _searchController.text = search;
      _recentSearches.remove(search);
      _recentSearches.insert(0, search);
      if (_recentSearches.length > 3) _recentSearches.removeLast();
    });
    _loadAssets();
  }

  // Xóa từ khóa hiện tại và tải lại toàn bộ tài sản
  void _clearSearch() {
    setState(() => _searchController.clear());
    _loadAssets();
  }

  // Mở trang chi tiết khi người dùng chọn một tài sản
  void _openDetail(Map<String, dynamic> asset) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AssetDetailScreen(assetId: asset['id'] as String),
      ),
    );
  }

  // Xử lý lỗi mạng và phiên đăng nhập hết hạn
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
    // Bố cục bộ lọc và danh sách tài sản
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tài sản'),
        centerTitle: true,
        actions: [
          // Mở tìm kiếm từ biểu tượng bên phải tiêu đề
          IconButton(
            onPressed: _loading ? null : _openSearch,
            tooltip: 'Tìm kiếm',
            icon: const Icon(Icons.search),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Giữ bộ lọc và nút sắp xếp luôn hiển thị để bố cục không bị
            // thay đổi đột ngột mỗi khi ứng dụng tải lại danh sách tài sản.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                children: [
                  if (_searchController.text.isNotEmpty) ...[
                    // Hiển thị từ khóa đang được áp dụng; tạm khóa thao tác xóa
                    // trong lúc tải để tránh gửi nhiều yêu cầu API chồng nhau.
                    Align(
                      alignment: Alignment.centerLeft,
                      child: InputChip(
                        label: Text(_searchController.text),
                        avatar: const Icon(Icons.search, size: 18),
                        onDeleted: _loading ? null : _clearSearch,
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String?>(
                          initialValue: _categoryId,
                          decoration: InputDecoration(
                            labelText: 'Danh mục',
                            border: const OutlineInputBorder(),
                            suffixIcon: _loading
                                ? const Padding(
                                    padding: EdgeInsets.all(14),
                                    child: SizedBox.square(
                                      dimension: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  )
                                : null,
                          ),
                          items: [
                            const DropdownMenuItem(
                              value: null,
                              child: Text('Tất cả danh mục'),
                            ),
                            ..._categories.map(
                              (category) => DropdownMenuItem(
                                value: category['id'] as String,
                                child: Text(category['name'] as String),
                              ),
                            ),
                          ],
                          onChanged: _loading
                              ? null
                              : (value) {
                                  setState(() => _categoryId = value);
                                  _loadAssets();
                                },
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filledTonal(
                        tooltip: _sort == 'name_asc' ? 'Tên A–Z' : 'Tên Z–A',
                        onPressed: _loading
                            ? null
                            : () {
                                setState(() {
                                  _sort = _sort == 'name_asc'
                                      ? 'name_desc'
                                      : 'name_asc';
                                });
                                _loadAssets();
                              },
                        icon: Icon(
                          _sort == 'name_asc'
                              ? Icons.sort_by_alpha
                              : Icons.sort_by_alpha_outlined,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Chỉ thay phần nội dung danh sách bằng trạng thái tải, nhờ đó
            // bộ lọc phía trên vẫn hiển thị nhưng đã được vô hiệu hóa an toàn.
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                      onRefresh: _loadData,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        children: [
                          if (_error != null)
                            _MessageState(
                              icon: Icons.cloud_off_outlined,
                              message: _error!,
                              buttonText: 'Thử lại',
                              onPressed: _loadData,
                            )
                          else if (_assets.isEmpty)
                            _MessageState(
                              icon: Icons.inventory_2_outlined,
                              message:
                                  _searchController.text.isEmpty &&
                                      _categoryId == null
                                  ? 'Bạn chưa quản lý tài sản nào.'
                                  : 'Không tìm thấy tài sản phù hợp.',
                            )
                          else
                            ..._assets.map(
                              (asset) => AssetCard(
                                asset: asset,
                                onTap: () => _openDetail(asset),
                              ),
                            ),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AssetSearchScreen extends StatefulWidget {
  const _AssetSearchScreen({
    required this.recentSearches,
    required this.initialSearch,
  });

  final List<String> recentSearches;
  final String initialSearch;

  @override
  State<_AssetSearchScreen> createState() => _AssetSearchScreenState();
}

class _AssetSearchScreenState extends State<_AssetSearchScreen> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    // Điền lại từ khóa đang dùng khi mở màn hình tìm kiếm
    _controller = TextEditingController(text: widget.initialSearch);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // Trả từ khóa hợp lệ về màn hình danh sách
  void _submit(String value) {
    final search = value.trim();
    if (search.isNotEmpty) Navigator.pop(context, search);
  }

  @override
  Widget build(BuildContext context) {
    // Màn hình tìm kiếm gọn
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            hintText: 'Tìm theo tên tài sản',
            border: InputBorder.none,
          ),
          onChanged: (_) => setState(() {}),
          onSubmitted: _submit,
        ),
        actions: [
          if (_controller.text.isNotEmpty)
            IconButton(
              onPressed: () {
                _controller.clear();
                setState(() {});
              },
              tooltip: 'Xóa',
              icon: const Icon(Icons.clear),
            ),
        ],
      ),
      body: ListView(
        children: [
          if (widget.recentSearches.isNotEmpty)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Tìm kiếm gần đây'),
            ),
          // Chạm vào lịch sử để tìm lại ngay lật tức
          ...widget.recentSearches.map(
            (search) => ListTile(
              leading: const Icon(Icons.history),
              title: Text(search),
              trailing: const Icon(Icons.north_west, size: 18),
              onTap: () => _submit(search),
            ),
          ),
        ],
      ),
    );
  }
}

class AssetCard extends StatelessWidget {
  const AssetCard({required this.asset, required this.onTap, super.key});

  final Map<String, dynamic> asset;
  final VoidCallback onTap;

  // Đổi trạng thái từ API thành nội dung dễ hiểu
  String _statusText(String status) {
    final value = status.toLowerCase();
    if (value == 'in_use' || value == 'using') return 'Đang sử dụng';
    if (value == 'repairing' || value == 'fixing') return 'Đang sửa chữa';
    if (value == 'available') return 'Sẵn sàng';
    return value.replaceAll('_', ' ');
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = asset['imageUrl'] as String?;

    // Thẻ hiển thị ảnh và thông tin chính của tài sản
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            SizedBox(
              width: 104,
              height: 132,
              child: imageUrl == null
                  ? const ColoredBox(
                      color: Color(0xFFE8EAF0),
                      child: Icon(Icons.inventory_2_outlined, size: 40),
                    )
                  : Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const ColoredBox(
                        color: Color(0xFFE8EAF0),
                        child: Icon(Icons.broken_image_outlined, size: 40),
                      ),
                    ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      asset['name'] ?? '',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      departmentLabel(asset['department'] as String?) ??
                          'Chưa có phòng ban',
                    ),
                    const SizedBox(height: 8),
                    Chip(label: Text(_statusText(asset['status'] ?? ''))),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.message,
    this.buttonText,
    this.onPressed,
  });

  final IconData icon;
  final String message;
  final String? buttonText;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    // Hiển thị trạng thái trống hoặc lỗi ở giữa màn hình
    return Padding(
      padding: const EdgeInsets.only(top: 72),
      child: Column(
        children: [
          Icon(icon, size: 48, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          if (buttonText != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onPressed, child: Text(buttonText!)),
          ],
        ],
      ),
    );
  }
}

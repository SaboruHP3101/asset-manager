import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/widgets/app_text.dart';
import '../login/login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const _apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  final _storage = const FlutterSecureStorage();
  final _dio = Dio(BaseOptions(baseUrl: _apiUrl));
  Map<String, dynamic>? _employee;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Tải hồ sơ ngay khi mở màn hình
    _loadProfile();
  }

  @override
  void dispose() {
    _dio.close();
    super.dispose();
  }

  // Gọi API bằng token đã lưu sau khi đăng nhập
  Future<void> _loadProfile() async {
    try {
      final token = await _storage.read(key: 'access_token');
      final response = await _dio.get<Map<String, dynamic>>(
        '/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      if (mounted) {
        setState(() => _employee = response.data);
      }
    } on DioException {
      if (mounted) {
        setState(() => _error = 'Không thể tải thông tin nhân viên.');
      }
    }
  }

  // Xóa token và quay về màn hình đăng nhập
  Future<void> _logout() async {
    await _storage.delete(key: 'access_token');
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  // Hiển thị một dòng thông tin rõ ràng, dễ đọc
  Widget _infoRow(IconData icon, String label, String? value) {
    return ListTile(
      leading: Icon(icon),
      title: AppText(label, type: AppTextType.h4),
      subtitle: Text(value?.isNotEmpty == true ? value! : 'Chưa cập nhật'),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Hiển thị trạng thái tải hoặc lỗi trước khi có dữ liệu
    if (_employee == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Hồ sơ'), centerTitle: true),
        body: Center(
          child: _error == null
              ? const CircularProgressIndicator()
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () {
                        setState(() => _error = null);
                        _loadProfile();
                      },
                      child: const Text('Thử lại'),
                    ),
                    TextButton(
                      onPressed: _logout,
                      child: const Text('Đăng xuất'),
                    ),
                  ],
                ),
        ),
      );
    }

    final employee = _employee!;
    final isHead = employee['isDepartmentHead'] == true ? 'Có' : 'Không';

    // Bố cục hồ sơ dạng danh sách
    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ'), centerTitle: true),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const CircleAvatar(radius: 42, child: Icon(Icons.person, size: 48)),
            const SizedBox(height: 12),
            AppText(
              employee['fullName'] ?? '',
              type: AppTextType.h1,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Card(
              child: Column(
                children: [
                  _infoRow(
                    Icons.badge_outlined,
                    'Mã nhân viên',
                    employee['employeeCode'],
                  ),
                  _infoRow(
                    Icons.person_outline,
                    'Họ và tên',
                    employee['fullName'],
                  ),
                  _infoRow(Icons.email_outlined, 'Email', employee['email']),
                  _infoRow(
                    Icons.phone_outlined,
                    'Số điện thoại',
                    employee['phoneNumber'],
                  ),
                  _infoRow(
                    Icons.apartment_outlined,
                    'Phòng ban',
                    employee['department'],
                  ),
                  _infoRow(Icons.work_outline, 'Vai trò', employee['role']),
                  _infoRow(
                    Icons.supervisor_account_outlined,
                    'Trưởng phòng',
                    isHead,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.tonalIcon(
              onPressed: _logout,
              icon: const Icon(Icons.logout),
              label: const Text('Đăng xuất'),
            ),
          ],
        ),
      ),
    );
  }
}

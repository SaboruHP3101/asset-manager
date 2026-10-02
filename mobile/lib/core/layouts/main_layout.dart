import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../features/assets/assets_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/login/login_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/repair_requests/repair_requests_screen.dart';
import '../auth/auth_session.dart';
import '../storage/token_storage.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;
  List<Widget>? _screens;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    setState(() => _error = null);
    try {
      final profile = await AuthSession.instance.load(force: true);
      if (!mounted) return;
      setState(() {
        _screens = [
          HomeScreen(profile: profile),
          AssetsScreen(),
          const RepairRequestsScreen(),
          ProfileScreen(),
        ];
      });
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        AuthSession.instance.clear();
        await TokenStorage.instance.clearAccessToken();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (_) => false,
        );
        return;
      }
      if (mounted) setState(() => _error = 'Không thể tải quyền người dùng.');
    } catch (_) {
      if (mounted) setState(() => _error = 'Không thể tải quyền người dùng.');
    }
  }

  void _onTabTapped(int index) {
    // Cập nhật màn hình khi người dùng chọn một tab
    setState(() {
      // Tạo lại màn Yêu cầu để phản ánh request vừa tạo từ tab Tài sản.
      if (index == 2) {
        _screens![2] = RepairRequestsScreen(key: UniqueKey());
      }
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_screens == null) {
      return Scaffold(
        body: Center(
          child: _error == null
              ? const CircularProgressIndicator()
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _loadSession,
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
        ),
      );
    }

    return Scaffold(
      // Giữ trạng thái của các màn hình khi đổi tab
      body: IndexedStack(index: _currentIndex, children: _screens!),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _onTabTapped,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Trang chủ',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'Tài sản',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment),
            label: 'Yêu cầu',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Hồ sơ',
          ),
        ],
      ),
    );
  }
}

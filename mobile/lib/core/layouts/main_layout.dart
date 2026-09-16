import 'package:flutter/material.dart';

import '../../features/home/presentation/home_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/assets/assets_screen.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;

  // Các màn hình chính được hiển thị từ thanh điều hướng
  final List<Widget> _screens = const [
    HomeScreen(),
    AssetsScreen(),
    Center(child: Text('Send Screen')),
    ProfileScreen(),
  ];

  void _onTabTapped(int index) {
    // Cập nhật màn hình khi người dùng chọn một tab
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Giữ trạng thái của các màn hình khi đổi tab
      body: IndexedStack(index: _currentIndex, children: _screens),
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

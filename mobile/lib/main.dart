import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'features/login/login_screen.dart';

void main() {
  runApp(const MainApp());
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'My Flutter App',
      home: const LoginScreen(),
      theme: buildAppTheme(),
    );
  }
}

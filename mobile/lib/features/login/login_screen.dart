import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/layouts/main_layout.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _tokenStorage = TokenStorage.instance;
  final _dio = ApiClient.instance.dio;

  bool _emailVerified = false;
  bool _loading = false;
  bool _hidePassword = true;
  bool _hideConfirmPassword = true;
  bool _firstTimeLogin = false;
  String? _activationToken;
  String? _emailError;
  String? _passwordError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  // Hàm kiểm tra xem giá trị nhập vào có phải là email hay không
  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Địa chỉ email bắt buộc';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Vui lòng nhập email';
    }
    return _emailError;
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _emailError = null;
      _passwordError = null;
    });
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);
    try {
      if (!_emailVerified) {
        final response = await _dio.post<Map<String, dynamic>>(
          '/auth/check-exists',
          data: {'email': _emailController.text.trim()},
        );
        if (!mounted) return;
        if (response.data?['exists'] == true) {
          setState(() {
            _emailVerified = true;
            _firstTimeLogin = response.data?['firstTimeLogin'] == true;
            _activationToken = response.data?['activationToken'] as String?;
          });
        } else {
          setState(
            () => _emailError = 'Không tìm thấy tài khoản với email này',
          );
        }
      } else if (_firstTimeLogin) {
        final response = await _dio.post<Map<String, dynamic>>(
          '/auth/setup-password',
          data: {'password': _passwordController.text},
          options: Options(
            headers: {'Authorization': 'Bearer $_activationToken'},
          ),
        );
        if (!mounted) return;
        final token = response.data?['access_token'] as String?;
        if (token == null) {
          setState(() => _passwordError = 'Không thể đặt mật khẩu');
          return;
        }
        await _completeLogin(token);
      } else {
        final response = await _dio.post<Map<String, dynamic>>(
          '/auth/login',
          data: {
            'email': _emailController.text.trim(),
            'password': _passwordController.text,
          },
        );
        if (!mounted) return;
        final token = response.data?['accessToken'] as String?;
        if (token == null) {
          setState(() => _passwordError = 'Không thể đăng nhập');
          return;
        }
        await _completeLogin(token);
      }
    } on DioException catch (error) {
      if (!mounted) return;
      final message = error.response?.data is Map
          ? error.response?.data['message']
          : null;
      setState(() {
        if (_emailVerified) {
          _passwordError = message is String
              ? message
              : 'Lỗi mạng. Vui lòng thử lại.';
        } else {
          _emailError = error.response?.statusCode == 404
              ? 'Không tìm thấy tài khoản với email này'
              : 'Lỗi mạng. Vui lòng thử lại.';
        }
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
    _formKey.currentState?.validate();
  }

  Future<void> _completeLogin(String token) async {
    await _tokenStorage.saveAccessToken(token);
    if (!mounted) return;
    Navigator.of(context)
        .pushReplacement(MaterialPageRoute(builder: (_) => const MainLayout()));
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemStatusBarContrastEnforced: false,
      ),
      child: Scaffold(
        body: SafeArea(
          top: false,
          child: SingleChildScrollView(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    height: 350,
                    width: double.infinity,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.asset(
                          'assets/images/warehouse.jpg',
                          fit: BoxFit.cover,
                        ),
                        const Align(
                          alignment: Alignment.topCenter,
                          child: SizedBox(
                            height: 35,
                            width: double.infinity,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Color.fromRGBO(0, 0, 0, 0.65),
                                    Colors.transparent,
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 38),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Chào mừng!',
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 18),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: _emailVerified
                              ? TextInputAction.next
                              : TextInputAction.done,
                          enabled: !_loading,
                          decoration: const InputDecoration(
                            labelText: 'Địa chỉ email',
                            border: OutlineInputBorder(),
                          ),
                          validator: _validateEmail,
                          onChanged: (_) {
                            if (_emailVerified) {
                              setState(() {
                                _emailVerified = false;
                                _firstTimeLogin = false;
                                _activationToken = null;
                                _passwordController.clear();
                                _confirmPasswordController.clear();
                              });
                            }
                            if (_emailError != null) {
                              setState(() => _emailError = null);
                            }
                          },
                          onFieldSubmitted: (_) {
                            if (!_emailVerified) _submit();
                          },
                        ),
                        if (_emailVerified) ...[
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _hidePassword,
                            textInputAction: TextInputAction.done,
                            enabled: !_loading,
                            decoration: InputDecoration(
                              labelText: 'Mật khẩu',
                              border: const OutlineInputBorder(),
                              suffixIcon: IconButton(
                                onPressed: () => setState(
                                  () => _hidePassword = !_hidePassword,
                                ),
                                icon: Icon(
                                  _hidePassword
                                      ? Icons.visibility_off
                                      : Icons.visibility,
                                ),
                              ),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Mật khẩu bắt buộc';
                              }
                              if (_firstTimeLogin && value.length < 6) {
                                return 'Mật khẩu phải ít nhất 6 ký tự';
                              }
                              return _passwordError;
                            },
                            onChanged: (_) {
                              if (_passwordError != null) {
                                setState(() => _passwordError = null);
                              }
                            },
                            onFieldSubmitted: (_) {
                              if (!_firstTimeLogin) _submit();
                            },
                          ),
                          if (_firstTimeLogin) ...[
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _confirmPasswordController,
                              obscureText: _hideConfirmPassword,
                              textInputAction: TextInputAction.done,
                              enabled: !_loading,
                              decoration: InputDecoration(
                                labelText: 'Retype password',
                                border: const OutlineInputBorder(),
                                suffixIcon: IconButton(
                                  onPressed: () => setState(
                                    () => _hideConfirmPassword =
                                        !_hideConfirmPassword,
                                  ),
                                  icon: Icon(
                                    _hideConfirmPassword
                                        ? Icons.visibility_off
                                        : Icons.visibility,
                                  ),
                                ),
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Vui lòng nhập lại mật khẩu';
                                }
                                if (value != _passwordController.text) {
                                  return 'Mẩu khẩu không trùng nhau';
                                }
                                return null;
                              },
                              onFieldSubmitted: (_) => _submit(),
                            ),
                          ],
                        ],
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _loading ? null : _submit,
                          child: _loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(
                                  !_emailVerified
                                      ? 'Tiếp theo'
                                      : _firstTimeLogin
                                      ? 'Tạo mật khẩu lần đầu'
                                      : 'Đăng nhập',
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

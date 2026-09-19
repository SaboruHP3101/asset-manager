import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  TokenStorage({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static final instance = TokenStorage();
  static const _accessTokenKey = 'access_token';

  final FlutterSecureStorage _storage;

  // Đọc access token hiện tại từ vùng lưu trữ được mã hóa của thiết bị.
  Future<String?> readAccessToken() {
    return _storage.read(key: _accessTokenKey);
  }

  // Lưu access token sau khi người dùng đăng nhập thành công.
  Future<void> saveAccessToken(String token) {
    return _storage.write(key: _accessTokenKey, value: token);
  }

  // Xóa access token khi đăng xuất hoặc khi phiên đăng nhập hết hạn.
  Future<void> clearAccessToken() {
    return _storage.delete(key: _accessTokenKey);
  }
}

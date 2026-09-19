import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/app_config.dart';

// Kiểm tra helper tạo URL dùng chung cho ảnh và tệp từ backend.
void main() {
  test('ghép API URL với đường dẫn tương đối', () {
    expect(
      AppConfig.absoluteUrl('/uploads/image.png'),
      '${AppConfig.apiUrl}/uploads/image.png',
    );
  });

  test('giữ nguyên URL tuyệt đối', () {
    const url = 'https://cdn.example.com/image.png';
    expect(AppConfig.absoluteUrl(url), url);
  });
}

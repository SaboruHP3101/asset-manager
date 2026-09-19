class AppConfig {
  AppConfig._();

  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  // Ghép đường dẫn tương đối từ backend thành URL đầy đủ để hiển thị tài nguyên.
  static String absoluteUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '$apiUrl$path';
  }
}

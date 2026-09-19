import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/token_storage.dart';

class ApiClient {
  ApiClient({Dio? dio, TokenStorage? tokenStorage})
    : dio = dio ?? Dio(BaseOptions(baseUrl: AppConfig.apiUrl)),
      _tokenStorage = tokenStorage ?? TokenStorage.instance {
    this.dio.interceptors.add(
      InterceptorsWrapper(onRequest: _addAuthorizationHeader),
    );
  }

  static final instance = ApiClient();

  final Dio dio;
  final TokenStorage _tokenStorage;

  // Tự động gắn access token vào mọi request cần xác thực nếu token tồn tại.
  Future<void> _addAuthorizationHeader(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.headers.containsKey('Authorization')) {
      handler.next(options);
      return;
    }

    final token = await _tokenStorage.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}

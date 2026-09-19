import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';

// Chạy các request qua adapter giả để kiểm tra interceptor mà không gọi mạng.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _RecordingAdapter adapter;
  late Dio dio;

  // Tạo lại dependency trước mỗi test để các trường hợp không ảnh hưởng nhau.
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    adapter = _RecordingAdapter();
    dio = Dio()..httpClientAdapter = adapter;
  });

  test('tự động gắn bearer token vào request', () async {
    FlutterSecureStorage.setMockInitialValues({'access_token': 'saved-token'});
    ApiClient(dio: dio, tokenStorage: TokenStorage());

    await dio.get<void>('/profile');

    expect(adapter.lastOptions?.headers['Authorization'], 'Bearer saved-token');
  });

  test('không gắn authorization khi chưa đăng nhập', () async {
    ApiClient(dio: dio, tokenStorage: TokenStorage());

    await dio.get<void>('/auth/login');

    expect(adapter.lastOptions?.headers.containsKey('Authorization'), isFalse);
  });

  test('không ghi đè authorization được truyền riêng cho request', () async {
    FlutterSecureStorage.setMockInitialValues({'access_token': 'saved-token'});
    ApiClient(dio: dio, tokenStorage: TokenStorage());

    await dio.get<void>(
      '/auth/setup-password',
      options: Options(headers: {'Authorization': 'Bearer activation-token'}),
    );

    expect(
      adapter.lastOptions?.headers['Authorization'],
      'Bearer activation-token',
    );
  });
}

class _RecordingAdapter implements HttpClientAdapter {
  RequestOptions? lastOptions;

  // Ghi lại request cuối và trả về response giả thành công cho bài test.
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastOptions = options;
    return ResponseBody.fromString('', 200);
  }

  // Adapter giả không sở hữu tài nguyên thật nên không cần thao tác khi đóng.
  @override
  void close({bool force = false}) {}
}

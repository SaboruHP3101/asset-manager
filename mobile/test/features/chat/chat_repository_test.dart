import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/chat/chat_repository.dart';

void main() {
  test('sends the server conversation ID and parses data/CSV from the authenticated API', () async {
    final dio = Dio();
    late RequestOptions sent;
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          sent = options;
          handler.resolve(
            Response(
              requestOptions: options,
              data: {
                'message': 'Một tài sản',
                'source': 'Tài sản',
                'scope': 'Của tôi',
                'asOf': '2026-10-24T08:00:00.000Z',
                'hasMore': false,
                'conversationId': 'd2d41a43-56c0-4906-9e98-f74956e74f63',
                'rows': [
                  {
                    'title': 'A1',
                    'kind': 'asset',
                    'fields': [
                      {'label': 'Tên', 'value': 'Laptop'},
                    ],
                  },
                ],
                'csv': 'Tên\r\nLaptop',
              },
            ),
          );
        },
      ),
    );
    final result = await ChatRepository(dio: dio).ask(
      'Tài sản của tôi',
      'd2d41a43-56c0-4906-9e98-f74956e74f63',
      CancelToken(),
    );
    expect(sent.path, '/chat/messages');
    expect(sent.data, {
      'message': 'Tài sản của tôi',
      'conversationId': 'd2d41a43-56c0-4906-9e98-f74956e74f63',
    });
    expect(sent.receiveTimeout, const Duration(seconds: 90));
    expect(result.conversationId, 'd2d41a43-56c0-4906-9e98-f74956e74f63');
    expect(result.rows.single.fields.single.value, 'Laptop');
    expect(result.rows.single.kind, 'asset');
    expect(result.csv, 'Tên\r\nLaptop');

    await ChatRepository(dio: dio).ask('Hỏi mới', null, CancelToken());
    expect(sent.data, {'message': 'Hỏi mới'});
  });

  test('reports expired sessions and actionable server errors', () {
    final options = RequestOptions(path: '/chat/messages');
    for (final status in [401, 403, 503]) {
      final error = DioException(
        requestOptions: options,
        response: Response(
          requestOptions: options,
          statusCode: status,
          data: {'message': 'Liên hệ IT để cấu hình.'},
        ),
      );
      expect(
        chatError(error),
        status == 401 ? contains('đăng nhập lại') : contains('Liên hệ IT'),
      );
    }
  });
}

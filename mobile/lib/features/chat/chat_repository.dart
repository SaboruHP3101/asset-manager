import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import 'chat_models.dart';

class ChatRepository {
  ChatRepository({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  final Dio _dio;

  Future<ChatReply> ask(
    String message,
    String? conversationId,
    CancelToken cancelToken,
  ) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/chat/messages',
      data: {'message': message, 'conversationId': ?conversationId},
      cancelToken: cancelToken,
      options: Options(receiveTimeout: const Duration(seconds: 90)),
    );

    return ChatReply.fromJson(response.data!);
  }
}

String chatError(Object error) {
  if (error is DioException) {
    if (error.response?.statusCode == 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    final body = error.response?.data;
    if (body is Map<String, dynamic> && body['message'] is String) {
      return body['message'] as String;
    }
  }
  return 'Không thể nhận câu trả lời. Kiểm tra kết nối và thử lại.';
}

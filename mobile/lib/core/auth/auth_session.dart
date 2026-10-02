import 'package:dio/dio.dart';

import '../network/api_client.dart';

class AuthenticatedProfile {
  const AuthenticatedProfile({
    required this.department,
    required this.isDepartmentHead,
    required this.allowedActions,
  });

  factory AuthenticatedProfile.fromJson(Map<String, dynamic> json) =>
      AuthenticatedProfile(
        department: json['department'] as String,
        isDepartmentHead: json['isDepartmentHead'] == true,
        allowedActions: Set<String>.from(
          json['allowedActions'] as List<dynamic>? ?? const [],
        ),
      );

  final String department;
  final bool isDepartmentHead;
  final Set<String> allowedActions;

  bool allows(String action) => allowedActions.contains(action);

  bool allowsAny(Iterable<String> actions) => actions.any(allows);
}

class AuthSession {
  AuthSession({Dio? dio}) : _dio = dio ?? ApiClient.instance.dio;

  static final instance = AuthSession();

  final Dio _dio;
  AuthenticatedProfile? profile;

  Future<AuthenticatedProfile> load({bool force = false}) async {
    if (!force && profile != null) return profile!;

    final response = await _dio.get<Map<String, dynamic>>('/auth/me');
    final loaded = AuthenticatedProfile.fromJson(response.data!);
    profile = loaded;

    return loaded;
  }

  void clear() => profile = null;
}

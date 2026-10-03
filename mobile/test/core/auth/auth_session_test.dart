import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth/auth_session.dart';

void main() {
  test('profile kiểm tra action từ dữ liệu /auth/me', () {
    final profile = AuthenticatedProfile.fromJson({
      'department': 'PROCUREMENT',
      'fullName': 'Nguyễn Văn An',
      'role': 'PROCUREMENT',
      'isDepartmentHead': false,
      'allowedActions': ['purchase.order.create', 'purchase.receipt.record'],
    });

    expect(profile.allows('purchase.order.create'), isTrue);
    expect(profile.fullName, 'Nguyễn Văn An');
    expect(profile.role, 'PROCUREMENT');
    expect(profile.allows('purchase.order.approve'), isFalse);
    expect(
      profile.allowsAny({
        'purchase.receipt.inspect_it',
        'purchase.receipt.record',
      }),
      isTrue,
    );
  });
}

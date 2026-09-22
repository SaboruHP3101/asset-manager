const roleLabels = {
  'IT': 'IT',
  'ACCOUNTING': 'Kế toán',
  'WAREHOUSE': 'Kho vận',
  'PROCUREMENT': 'Thu mua',
  'EXECUTIVE': 'Ban Điều hành',
};

String? roleLabel(String? role) {
  if (role == null) return null;
  return roleLabels[role] ?? role;
}

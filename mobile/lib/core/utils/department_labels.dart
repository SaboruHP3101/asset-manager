const departmentLabels = {
  'IT': 'Phòng Công nghệ thông tin',
  'ACCOUNTING': 'Phòng Kế toán',
  'WAREHOUSE': 'Phòng Kho vận',
  'PROCUREMENT': 'Phòng Thu mua',
  'EXECUTIVE': 'Ban Điều hành',
};

String? departmentLabel(String? department) {
  if (department == null) return null;
  return departmentLabels[department] ?? department;
}

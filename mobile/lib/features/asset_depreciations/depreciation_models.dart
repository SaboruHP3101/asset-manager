import '../../core/utils/group_display_digits.dart';

class DepreciationPeriod {
  DepreciationPeriod.fromJson(Map<String, dynamic> json)
    : id = json['id'] as String,
      month = json['month'] as String,
      status = json['status'] as String,
      calculatedAt = json['calculatedAt'] as String?,
      submittedBy = json['submittedBy'] as String?,
      returnReason = json['returnReason'] as String?,
      lines = (json['lines'] as List? ?? const [])
          .map(
            (line) => DepreciationLine.fromJson(line as Map<String, dynamic>),
          )
          .toList(),
      history = (json['history'] as List? ?? const [])
          .map(
            (entry) =>
                DepreciationHistory.fromJson(entry as Map<String, dynamic>),
          )
          .toList(),
      _assetCount = json['assetCount'] as int?,
      _total = json['totalDepreciation'] as String?;

  final String id;
  final String month;
  final String status;
  final String? calculatedAt;
  final String? submittedBy;
  final String? returnReason;
  final List<DepreciationLine> lines;
  final List<DepreciationHistory> history;
  final int? _assetCount;
  final String? _total;

  int get assetCount => _assetCount ?? lines.length;
  String get total =>
      _total ??
      lines
          .fold(BigInt.zero, (sum, line) => sum + BigInt.parse(line.amount))
          .toString();
  String get monthLabel => '${month.substring(5, 7)}/${month.substring(0, 4)}';
  String get statusLabel => switch (status) {
    'draft' => returnReason == null ? 'Nháp' : 'Cần chỉnh sửa',
    'pending_approval' => 'Chờ duyệt',
    'recorded' => 'Đã ghi nhận',
    _ => status,
  };
}

class DepreciationLine {
  DepreciationLine.fromJson(Map<String, dynamic> json)
    : assetCode = json['assetCode'] as String,
      name = json['name'] as String?,
      originalCost = json['originalCost'] as String,
      termMonths = json['termMonths'] as int,
      openingValue = json['openingValue'] as String,
      amount = json['depreciationAmount'] as String,
      remainingValue = json['remainingValue'] as String,
      fromDate = json['fromDate'] as String,
      toDate = json['toDate'] as String;

  final String assetCode;
  final String? name;
  final String originalCost;
  final int termMonths;
  final String openingValue;
  final String amount;
  final String remainingValue;
  final String fromDate;
  final String toDate;
}

class DepreciationHistory {
  DepreciationHistory.fromJson(Map<String, dynamic> json)
    : action = json['action'] as String,
      actorName = json['actorName'] as String,
      reason = json['reason'] as String?,
      createdAt = json['createdAt'] as String;

  final String action;
  final String actorName;
  final String? reason;
  final String createdAt;

  String get label => switch (action) {
    'depreciation.submitted' => 'Trình duyệt',
    'depreciation.returned' => 'Trả về chỉnh sửa',
    'depreciation.approved' => 'Duyệt và ghi nhận',
    _ => action,
  };
}

String depreciationMoney(String value) => '${groupDisplayDigits(value)} ₫';

String depreciationDate(String value) =>
    '${value.substring(8, 10)}/${value.substring(5, 7)}/${value.substring(0, 4)}';

String depreciationTimestamp(String value) {
  final date = DateTime.parse(value).toLocal();
  return '${depreciationDate(date.toIso8601String())} '
      '${date.hour.toString().padLeft(2, '0')}:'
      '${date.minute.toString().padLeft(2, '0')}';
}

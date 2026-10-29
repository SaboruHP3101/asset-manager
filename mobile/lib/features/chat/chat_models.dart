class ChatField {
  const ChatField({required this.label, required this.value});

  factory ChatField.fromJson(Map<String, dynamic> json) =>
      ChatField(label: json['label'] as String, value: json['value'] as String);

  final String label;
  final String value;
}

class ChatRow {
  const ChatRow({
    required this.title,
    required this.fields,
    this.imageUrl,
    this.kind,
  });

  factory ChatRow.fromJson(Map<String, dynamic> json) => ChatRow(
    title: json['title'] as String,
    fields: (json['fields'] as List<dynamic>)
        .map((item) => ChatField.fromJson(item as Map<String, dynamic>))
        .toList(),
    imageUrl: json['imageUrl'] as String?,
    kind: json['kind'] as String?,
  );

  final String title;
  final List<ChatField> fields;
  final String? imageUrl;
  final String? kind;
}

class ChatReply {
  const ChatReply({
    required this.message,
    required this.source,
    required this.scope,
    required this.asOf,
    required this.rows,
    required this.hasMore,
    this.csv,
    this.conversationId,
  });

  factory ChatReply.fromJson(Map<String, dynamic> json) => ChatReply(
    message: json['message'] as String,
    source: json['source'] as String,
    scope: json['scope'] as String,
    asOf: DateTime.parse(json['asOf'] as String),
    rows: (json['rows'] as List<dynamic>)
        .map((item) => ChatRow.fromJson(item as Map<String, dynamic>))
        .toList(),
    hasMore: json['hasMore'] as bool,
    csv: json['csv'] as String?,
    conversationId: json['conversationId'] as String?,
  );

  final String message;
  final String source;
  final String scope;
  final DateTime asOf;
  final List<ChatRow> rows;
  final bool hasMore;
  final String? csv;
  final String? conversationId;
}

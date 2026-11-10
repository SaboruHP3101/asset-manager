/// Separates groups of three digits with dots for display.
String groupDisplayDigits(String value) =>
    value.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');

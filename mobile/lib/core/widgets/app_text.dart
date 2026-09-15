import 'package:flutter/material.dart';

enum AppTextType { h1, h2, h3, h4, h5, bodyXl, bodyL, bodyM, bodyS, bodyXs }

class AppText extends StatelessWidget {
  final String text;
  final AppTextType type;
  final Color? color;
  final double? fontSize;
  final FontWeight? fontWeight;
  final String fontFamily;
  final double? lineHeight;
  final TextAlign textAlign;
  final int? maxLines;
  final TextOverflow overflow;

  const AppText(
    this.text, {
    super.key,
    required this.type,
    this.color,
    this.fontSize,
    this.fontWeight,
    this.fontFamily = 'Roboto',
    this.lineHeight,
    this.textAlign = TextAlign.start,
    this.maxLines,
    this.overflow = TextOverflow.clip,
  });

  /// Factory: Create AppText with automatic theme inheritance
  factory AppText.fromTheme(
    String text, {
    Key? key,
    required BuildContext context,
    required AppTextType type,
    Color? color,
    double? fontSize,
    FontWeight? fontWeight,
    String fontFamily = 'Roboto',
    double? lineHeight,
    TextAlign textAlign = TextAlign.start,
    int? maxLines,
    TextOverflow overflow = TextOverflow.clip,
  }) {
    final theme = Theme.of(context);

    // Lấy màu từ theme nếu không được chỉ định rõ ràng
    Color resolvedColor = color ?? _getDefaultColorFromTheme(theme, type);

    return AppText(
      text,
      key: key,
      type: type,
      color: resolvedColor,
      fontSize: fontSize,
      fontWeight: fontWeight,
      fontFamily: fontFamily,
      lineHeight: lineHeight,
      textAlign: textAlign,
      maxLines: maxLines,
      overflow: overflow,
    );
  }

  /// Lấy màu văn bản mặc định dựa vào loại và theme
  static Color _getDefaultColorFromTheme(ThemeData theme, AppTextType type) {
    switch (type) {
      case AppTextType.h1:
      case AppTextType.h2:
      case AppTextType.h3:
      case AppTextType.h4:
      case AppTextType.h5:
        return theme.textTheme.headlineSmall?.color ?? Colors.black87;
      case AppTextType.bodyXl:
      case AppTextType.bodyL:
      case AppTextType.bodyM:
        return theme.textTheme.bodyMedium?.color ?? Colors.black87;
      case AppTextType.bodyS:
      case AppTextType.bodyXs:
        return theme.textTheme.bodySmall?.color ?? Colors.black54;
    }
  }

  /// Lấy cấu hình kiểu mặc định cho một kiểu văn bản
  Map<String, dynamic> _getStyleConfig(AppTextType type) {
    switch (type) {
      case AppTextType.h1:
        return {'fontSize': 24.0, 'fontWeight': FontWeight.w600};
      case AppTextType.h2:
        return {'fontSize': 18.0, 'fontWeight': FontWeight.w600};
      case AppTextType.h3:
        return {'fontSize': 16.0, 'fontWeight': FontWeight.w600};
      case AppTextType.h4:
        return {'fontSize': 14.0, 'fontWeight': FontWeight.w600};
      case AppTextType.h5:
        return {'fontSize': 12.0, 'fontWeight': FontWeight.w600};
      case AppTextType.bodyXl:
        return {'fontSize': 18.0, 'fontWeight': FontWeight.w400};
      case AppTextType.bodyL:
        return {'fontSize': 16.0, 'fontWeight': FontWeight.w400};
      case AppTextType.bodyM:
        return {'fontSize': 14.0, 'fontWeight': FontWeight.w400};
      case AppTextType.bodyS:
        return {'fontSize': 12.0, 'fontWeight': FontWeight.w400};
      case AppTextType.bodyXs:
        return {'fontSize': 10.0, 'fontWeight': FontWeight.w400};
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = _getStyleConfig(type);
    final resolvedFontSize = fontSize ?? config['fontSize'] as double;
    final resolvedFontWeight = fontWeight ?? config['fontWeight'] as FontWeight;

    return Text(
      text,
      textAlign: textAlign,
      maxLines: maxLines,
      overflow: overflow,
      style: TextStyle(
        fontSize: resolvedFontSize,
        fontWeight: resolvedFontWeight,
        fontFamily: fontFamily,
        color: color,
        height: lineHeight,
      ),
    );
  }
}

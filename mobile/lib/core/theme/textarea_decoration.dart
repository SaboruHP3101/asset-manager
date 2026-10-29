import 'package:flutter/material.dart';

InputDecoration textareaDecoration(
  BuildContext context,
  InputDecoration decoration,
) {
  final effective = decoration.applyDefaults(
    Theme.of(context).inputDecorationTheme,
  );

  InputBorder? roundedBorder(InputBorder? border) =>
      border is OutlineInputBorder
      ? border.copyWith(borderRadius: BorderRadius.circular(16))
      : border;

  return effective.copyWith(
    border: roundedBorder(effective.border),
    enabledBorder: roundedBorder(effective.enabledBorder),
    disabledBorder: roundedBorder(effective.disabledBorder),
    focusedBorder: roundedBorder(effective.focusedBorder),
    errorBorder: roundedBorder(effective.errorBorder),
    focusedErrorBorder: roundedBorder(effective.focusedErrorBorder),
  );
}

import 'package:flutter/material.dart';

ThemeData buildAppTheme() {
  const background = Color(0xfffaf9f6);
  const charcoal = Color(0xff25231d);
  final colors = ColorScheme.fromSeed(seedColor: const Color(0xfffdc700))
      .copyWith(
        primaryContainer: const Color(0xffffedac),
        onPrimaryContainer: charcoal,
        secondaryContainer: const Color(0xfffdc700),
        onSecondaryContainer: charcoal,
        surface: const Color(0xfffffdf9),
        onSurface: charcoal,
      );
  final cardShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(20),
    side: BorderSide(color: colors.outlineVariant),
  );
  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(999),
    borderSide: BorderSide(color: colors.outlineVariant),
  );
  const buttonShape = StadiumBorder();
  final filledStyle = FilledButton.styleFrom(
    backgroundColor: colors.secondaryContainer,
    foregroundColor: colors.onSecondaryContainer,
    minimumSize: const Size(0, 48),
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
    shape: buttonShape,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colors,
    scaffoldBackgroundColor: background,
    appBarTheme: AppBarThemeData(
      backgroundColor: background,
      foregroundColor: charcoal,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    cardTheme: CardThemeData(
      color: colors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: cardShape,
      clipBehavior: Clip.antiAlias,
    ),
    inputDecorationTheme: InputDecorationThemeData(
      filled: true,
      fillColor: colors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: inputBorder,
      enabledBorder: inputBorder,
      disabledBorder: inputBorder.copyWith(
        borderSide: BorderSide(
          color: colors.outlineVariant.withValues(alpha: 0.5),
        ),
      ),
      focusedBorder: inputBorder.copyWith(
        borderSide: BorderSide(color: colors.primary, width: 1.5),
      ),
      errorBorder: inputBorder.copyWith(
        borderSide: BorderSide(color: colors.error),
      ),
      focusedErrorBorder: inputBorder.copyWith(
        borderSide: BorderSide(color: colors.error, width: 1.5),
      ),
      errorMaxLines: 3,
    ),
    filledButtonTheme: FilledButtonThemeData(style: filledStyle),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: colors.secondaryContainer,
        foregroundColor: colors.onSecondaryContainer,
        elevation: 0,
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: buttonShape,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.onSurface,
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        side: BorderSide(color: colors.outlineVariant),
        shape: buttonShape,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      indicatorColor: colors.secondaryContainer,
      indicatorShape: const StadiumBorder(),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? colors.onSecondaryContainer
              : colors.onSurfaceVariant,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(WidgetState.selected)
              ? colors.onSurface
              : colors.onSurfaceVariant,
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w400,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: colors.surface,
      selectedColor: colors.primaryContainer,
      side: BorderSide(color: colors.outlineVariant),
      shape: const StadiumBorder(),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      clipBehavior: Clip.antiAlias,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: colors.secondaryContainer,
      foregroundColor: colors.onSecondaryContainer,
      elevation: 0,
      shape: buttonShape,
    ),
    dividerTheme: DividerThemeData(color: colors.outlineVariant),
  );
}

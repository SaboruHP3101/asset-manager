import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

typedef CodeScannerLauncher = Future<List<String>?> Function(
  BuildContext context, {
  required String title,
  required int targetCount,
  required List<String> initialCodes,
});

Future<List<String>?> openCodeScanner(
  BuildContext context, {
  required String title,
  required int targetCount,
  required List<String> initialCodes,
}) => Navigator.of(context).push<List<String>>(
  MaterialPageRoute(
    builder: (_) => CodeScannerScreen(
      title: title,
      targetCount: targetCount,
      initialCodes: initialCodes,
    ),
  ),
);

class CodeScannerScreen extends StatefulWidget {
  const CodeScannerScreen({
    required this.title,
    required this.targetCount,
    required this.initialCodes,
    super.key,
  });

  final String title;
  final int targetCount;
  final List<String> initialCodes;

  @override
  State<CodeScannerScreen> createState() => _CodeScannerScreenState();
}

class _CodeScannerScreenState extends State<CodeScannerScreen> {
  final MobileScannerController _scannerController = MobileScannerController();
  final ImagePicker _imagePicker = ImagePicker();
  late final List<String> _codes = [...widget.initialCodes];
  String? _message;
  bool _analyzingImage = false;
  bool _closing = false;

  @override
  void dispose() {
    unawaited(_scannerController.dispose());
    super.dispose();
  }

  Future<void> _pickImage() async {
    if (_analyzingImage || _closing) return;
    if (kIsWeb) {
      setState(() => _message = 'Chọn ảnh QR chưa được hỗ trợ trên web.');
      return;
    }

    setState(() {
      _analyzingImage = true;
      _message = null;
    });

    try {
      final image = await _imagePicker.pickImage(source: ImageSource.gallery);
      if (image == null || !mounted) return;

      final capture = await _scannerController.analyzeImage(image.path);
      if (!mounted) return;
      if (capture == null ||
          !capture.barcodes.any(
            (barcode) => barcode.rawValue?.trim().isNotEmpty ?? false,
          )) {
        setState(() => _message = 'Không tìm thấy mã QR trong ảnh đã chọn.');
        return;
      }

      _detect(capture);
    } catch (_) {
      if (mounted) {
        setState(
          () => _message =
              'Không thể đọc ảnh. Hãy chọn ảnh rõ nét có chứa mã QR.',
        );
      }
    } finally {
      if (mounted && !_closing) {
        setState(() => _analyzingImage = false);
      }
    }
  }

  void _detect(BarcodeCapture capture) {
    if (_closing) return;

    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value == null || value.isEmpty) continue;
      if (_codes.contains(value)) {
        setState(() => _message = 'Mã này đã được quét.');
        return;
      }
      if (_codes.length >= widget.targetCount) {
        setState(() => _message = 'Đã đủ ${widget.targetCount} mã.');
        return;
      }

      setState(() {
        _codes.add(value);
        _message = 'Đã thêm $value';
      });
      if (_codes.length == widget.targetCount) {
        _closing = true;
        Navigator.pop(context, List<String>.unmodifiable(_codes));
      }
      return;
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: Column(
      children: [
        Expanded(
          child: MobileScanner(
            controller: _scannerController,
            onDetect: _detect,
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Đã quét ${_codes.length}/${widget.targetCount}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (_message != null) Text(_message!),
                if (_codes.isNotEmpty)
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 144),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: _codes.length,
                      itemBuilder: (context, index) => ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(_codes[index]),
                        trailing: IconButton(
                          tooltip: 'Xóa ${_codes[index]}',
                          onPressed: () => setState(() {
                            _codes.removeAt(index);
                            _message = null;
                          }),
                          icon: const Icon(Icons.close),
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _analyzingImage ? null : _pickImage,
                  icon: _analyzingImage
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.photo_library_outlined),
                  label: Text(
                    _analyzingImage ? 'Đang đọc ảnh...' : 'Chọn ảnh QR',
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _codes.isEmpty
                      ? null
                      : () => Navigator.pop(
                          context,
                          List<String>.unmodifiable(_codes),
                        ),
                  child: const Text('Xong'),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

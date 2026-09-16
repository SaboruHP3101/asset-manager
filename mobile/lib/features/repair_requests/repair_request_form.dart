import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:video_player/video_player.dart';

class RepairRequestForm extends StatefulWidget {
  const RepairRequestForm({this.initialAssetId, super.key});

  final String? initialAssetId;

  @override
  State<RepairRequestForm> createState() => _RepairRequestFormState();
}

class _RepairRequestFormState extends State<RepairRequestForm> {
  static const _apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _descriptionFocus = FocusNode();
  final _storage = const FlutterSecureStorage();
  final _picker = ImagePicker();
  final _dio = Dio(BaseOptions(baseUrl: _apiUrl));
  final List<XFile> _media = [];
  List<Map<String, dynamic>> _assets = [];
  String? _assetId;
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _assetId = widget.initialAssetId;
    // Tải danh sách tài sản cho dropdown dùng chung
    _loadAssets();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _descriptionFocus.dispose();
    _dio.close();
    super.dispose();
  }

  // Đóng bàn phím trước và sau khi mở màn hình khác
  void _removeFocus() {
    _descriptionFocus.unfocus();
    FocusManager.instance.primaryFocus?.unfocus();
  }

  // Tạo header xác thực cho các API cá nhân
  Future<Options> _authOptions() async {
    final token = await _storage.read(key: 'access_token');
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  // Lấy các tài sản mà nhân viên hiện tại đang quản lý
  Future<void> _loadAssets() async {
    try {
      final response = await _dio.get<List<dynamic>>(
        '/assets/mine',
        options: await _authOptions(),
      );
      if (!mounted) return;
      setState(() {
        _assets = (response.data ?? []).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } on DioException {
      if (mounted) setState(() => _loading = false);
    }
  }

  // Chọn cách thêm ảnh hoặc video
  Future<void> _showMediaOptions() async {
    _removeFocus();
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Chọn ảnh từ thư viện'),
              onTap: () {
                Navigator.pop(context);
                _pickImages();
              },
            ),
            ListTile(
              leading: const Icon(Icons.video_library_outlined),
              title: const Text('Chọn video từ thư viện'),
              onTap: () {
                Navigator.pop(context);
                _pickVideo(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Chụp ảnh'),
              onTap: () {
                Navigator.pop(context);
                _pickImageFromCamera();
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam_outlined),
              title: const Text('Quay video'),
              onTap: () {
                Navigator.pop(context);
                _pickVideo(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
    _removeFocus();
  }

  // Thêm nhiều ảnh từ thư viện
  Future<void> _pickImages() async {
    final files = await _picker.pickMultiImage();
    if (mounted) setState(() => _media.addAll(files));
  }

  // Chụp một ảnh bằng camera
  Future<void> _pickImageFromCamera() async {
    final file = await _picker.pickImage(source: ImageSource.camera);
    if (file != null && mounted) setState(() => _media.add(file));
  }

  // Chọn hoặc quay một video
  Future<void> _pickVideo(ImageSource source) async {
    final file = await _picker.pickVideo(source: source);
    if (file != null && mounted) setState(() => _media.add(file));
  }

  // Quét QR và chọn tài sản tương ứng trong dropdown
  Future<void> _scanQrCode() async {
    _removeFocus();
    final qrCode = await Navigator.of(
      context,
    ).push<String>(MaterialPageRoute(builder: (_) => const _QrScannerScreen()));
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) => _removeFocus());
    if (qrCode == null) return;

    final matches = _assets.where((asset) => asset['qrCode'] == qrCode);
    if (matches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mã QR không thuộc tài sản của bạn.')),
      );
      return;
    }
    setState(() => _assetId = matches.first['id'] as String);
  }

  // Gửi dữ liệu và các tệp đã chọn bằng multipart form
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    try {
      final files = <MultipartFile>[];
      for (final file in _media) {
        files.add(await MultipartFile.fromFile(file.path, filename: file.name));
      }
      final form = FormData.fromMap({
        'assetId': _assetId,
        'issueDescription': _descriptionController.text.trim(),
        'files': files,
      });
      await _dio.post(
        '/repair-requests/mine',
        data: form,
        options: await _authOptions(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Đã gửi yêu cầu sửa chữa.')));
      Navigator.pop(context, true);
    } on DioException catch (error) {
      if (!mounted) return;
      final message = error.response?.data is Map
          ? error.response?.data['message']
          : null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            message is String ? message : 'Không thể gửi yêu cầu sửa chữa.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // Lấy tên tệp gọn để hiển thị trong danh sách
  String _fileName(XFile file) {
    return file.path.split(RegExp(r'[/\\]')).last;
  }

  // Đổi số byte thành dung lượng dễ đọc
  String _fileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  // Kiểm tra tệp video bằng phần mở rộng phổ biến
  bool _isVideo(XFile file) {
    return RegExp(
      r'\.(mp4|mov|avi|mkv)$',
      caseSensitive: false,
    ).hasMatch(file.name);
  }

  // Mở trang xem trước khi chạm vào tệp đã chọn
  void _previewMedia(XFile file) {
    _removeFocus();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            _MediaPreviewScreen(file: file, isVideo: _isVideo(file)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Form dùng chung cho tài sản được chọn hoặc quét QR
    return Scaffold(
      appBar: AppBar(title: const Text('Tạo yêu cầu sửa chữa')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: _assetId,
                      decoration: InputDecoration(
                        label: const Text.rich(
                          TextSpan(
                            text: 'Tài sản cần sửa chữa ',
                            children: [
                              TextSpan(
                                text: '*',
                                style: TextStyle(color: Colors.red),
                              ),
                            ],
                          ),
                        ),
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          onPressed: _scanQrCode,
                          tooltip: 'Quét mã QR',
                          icon: const Icon(Icons.qr_code_scanner),
                        ),
                      ),
                      items: _assets
                          .map(
                            (asset) => DropdownMenuItem(
                              value: asset['id'] as String,
                              child: Text(
                                '${asset['assetCode']} • ${asset['name']}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => _assetId = value),
                      validator: (value) => value == null
                          ? 'Vui lòng chọn tài sản cần sửa chữa'
                          : null,
                    ),
                    const SizedBox(height: 20),
                    const Text.rich(
                      TextSpan(
                        text: 'Triệu chứng gặp phải ',
                        children: [
                          TextSpan(
                            text: '*',
                            style: TextStyle(color: Colors.red),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _descriptionController,
                      focusNode: _descriptionFocus,
                      minLines: 4,
                      maxLines: 6,
                      decoration: const InputDecoration(
                        hintText: 'Mô tả triệu chứng của tài sản',
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) => value?.trim().isEmpty == true
                          ? 'Vui lòng nhập triệu chứng gặp phải'
                          : null,
                    ),
                    const SizedBox(height: 20),
                    Card(
                      child: ListTile(
                        title: const Text('Hình ảnh/Video'),
                        subtitle: Text('Đã chọn ${_media.length} mục'),
                        trailing: OutlinedButton.icon(
                          onPressed: _showMediaOptions,
                          icon: const Icon(Icons.add_photo_alternate_outlined),
                          label: const Text('Thêm'),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Danh sách tệp đã chọn với nút xóa bên phải
                    ..._media.asMap().entries.map(
                      (entry) => Card(
                        child: ListTile(
                          leading: Icon(
                            _isVideo(entry.value)
                                ? Icons.videocam_outlined
                                : Icons.image_outlined,
                          ),
                          title: Text(
                            _fileName(entry.value),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: FutureBuilder<int>(
                            future: entry.value.length(),
                            builder: (context, snapshot) => Text(
                              snapshot.hasData
                                  ? _fileSize(snapshot.data!)
                                  : 'Đang đọc dung lượng...',
                            ),
                          ),
                          trailing: IconButton(
                            onPressed: () =>
                                setState(() => _media.removeAt(entry.key)),
                            tooltip: 'Xóa',
                            icon: const Icon(Icons.close),
                          ),
                          onTap: () => _previewMedia(entry.value),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: _submitting ? null : _submit,
                      icon: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_outlined),
                      label: const Text('Gửi yêu cầu sửa chữa'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _MediaPreviewScreen extends StatefulWidget {
  const _MediaPreviewScreen({required this.file, required this.isVideo});

  final XFile file;
  final bool isVideo;

  @override
  State<_MediaPreviewScreen> createState() => _MediaPreviewScreenState();
}

class _MediaPreviewScreenState extends State<_MediaPreviewScreen> {
  VideoPlayerController? _videoController;

  @override
  void initState() {
    super.initState();
    // Chuẩn bị bộ phát khi tệp được chọn là video
    if (widget.isVideo) _loadVideo();
  }

  // Mở video cục bộ và cập nhật giao diện khi sẵn sàng
  Future<void> _loadVideo() async {
    final controller = VideoPlayerController.file(File(widget.file.path));
    await controller.initialize();
    if (!mounted) {
      controller.dispose();
      return;
    }
    await controller.play();
    setState(() => _videoController = controller);
  }

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _videoController;

    // Xem ảnh hoặc video toàn màn hình với nút phát cơ bản
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        foregroundColor: Colors.white,
        backgroundColor: Colors.black,
        title: Text(widget.file.name, maxLines: 1),
      ),
      body: Center(
        child: widget.isVideo
            ? controller == null
                  ? const CircularProgressIndicator()
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        AspectRatio(
                          aspectRatio: controller.value.aspectRatio,
                          child: VideoPlayer(controller),
                        ),
                        VideoProgressIndicator(
                          controller,
                          allowScrubbing: true,
                          padding: const EdgeInsets.all(16),
                        ),
                        IconButton.filled(
                          onPressed: () {
                            setState(() {
                              controller.value.isPlaying
                                  ? controller.pause()
                                  : controller.play();
                            });
                          },
                          icon: Icon(
                            controller.value.isPlaying
                                ? Icons.pause
                                : Icons.play_arrow,
                          ),
                        ),
                      ],
                    )
            : InteractiveViewer(
                child: Image.file(File(widget.file.path), fit: BoxFit.contain),
              ),
      ),
    );
  }
}

class _QrScannerScreen extends StatefulWidget {
  const _QrScannerScreen();

  @override
  State<_QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<_QrScannerScreen> {
  bool _found = false;

  @override
  Widget build(BuildContext context) {
    // Camera quét một mã QR rồi tự quay lại form
    return Scaffold(
      appBar: AppBar(title: const Text('Quét mã QR tài sản')),
      body: MobileScanner(
        onDetect: (capture) {
          if (_found || capture.barcodes.isEmpty) return;
          final value = capture.barcodes.first.rawValue;
          if (value == null) return;
          _found = true;
          Navigator.pop(context, value);
        },
      ),
    );
  }
}

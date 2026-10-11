import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:video_player/video_player.dart';

import '../../core/network/api_client.dart';

class RepairRequestForm extends StatefulWidget {
  const RepairRequestForm({
    this.initialAssetId,
    this.requestId,
    this.initialDescription = '',
    this.revisionRequired = false,
    super.key,
  });

  final String? initialAssetId;
  final String? requestId;
  final String initialDescription;
  final bool revisionRequired;

  @override
  State<RepairRequestForm> createState() => _RepairRequestFormState();
}

class _RepairRequestFormState extends State<RepairRequestForm> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _descriptionFocus = FocusNode();
  final _picker = ImagePicker();
  final _dio = ApiClient.instance.dio;
  final List<XFile> _media = [];
  List<Map<String, dynamic>> _assets = [];
  String? _assetId;
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _assetId = widget.initialAssetId;
    _descriptionController.text = widget.initialDescription;
    // Tải danh sách tài sản cho dropdown dùng chung
    _loadAssets();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _descriptionFocus.dispose();
    super.dispose();
  }

  // Đóng bàn phím trước và sau khi mở màn hình khác
  void _removeFocus() {
    _descriptionFocus.unfocus();
    FocusManager.instance.primaryFocus?.unfocus();
  }

  // Lấy tài sản của nhân viên và loại các tài sản đang có yêu cầu chưa kết thúc.
  Future<void> _loadAssets() async {
    try {
      final responses = await Future.wait([
        _dio.get<List<dynamic>>('/assets/mine'),
        _dio.get<List<dynamic>>('/repair-requests/mine'),
      ]);
      final assets = (responses[0].data ?? []).cast<Map<String, dynamic>>();
      final requests = (responses[1].data ?? []).cast<Map<String, dynamic>>();
      final activeAssetIds = requests
          .where((request) {
            final status = request['status']?.toString();
            return status != 'closed' && status != 'cancelled';
          })
          .map((request) => request['assetId']?.toString())
          .whereType<String>()
          .toSet();
      if (widget.requestId != null) activeAssetIds.remove(_assetId);
      final availableAssets = assets
          .where((asset) => !activeAssetIds.contains(asset['id']?.toString()))
          .toList();

      if (!mounted) return;
      setState(() {
        _assets = availableAssets;
        if (!_assets.any((asset) => asset['id'] == _assetId)) {
          _assetId = null;
        }
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
  Future<void> _save({required bool submit}) async {
    if (submit && !_formKey.currentState!.validate()) return;
    if (submit && !await _review()) return;
    setState(() => _submitting = true);

    try {
      String requestId;

      if (widget.requestId == null) {
        final files = <MultipartFile>[];
        for (final file in _media) {
          files.add(
            await MultipartFile.fromFile(file.path, filename: file.name),
          );
        }
        final form = FormData.fromMap({
          'assetId': _assetId,
          'issueDescription': _descriptionController.text.trim(),
          'files': files,
        });
        final response = await _dio.post<Map<String, dynamic>>(
          '/repair-requests/mine',
          data: form,
        );
        requestId = response.data!['id'] as String;
      } else {
        requestId = widget.requestId!;
        await _dio.patch<void>(
          '/repair-requests/$requestId',
          data: {'issueDescription': _descriptionController.text.trim()},
        );
      }

      if (submit) {
        final action = widget.revisionRequired ? 'resubmit' : 'submit';
        await _dio.post<void>('/repair-requests/$requestId/$action');
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            submit ? 'Đã gửi yêu cầu sửa chữa.' : 'Đã lưu bản nháp.',
          ),
        ),
      );
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

  Future<bool> _review() async {
    final asset = _assets.cast<Map<String, dynamic>?>().firstWhere(
      (item) => item?['id'] == _assetId,
      orElse: () => null,
    );

    return (await showModalBottomSheet<bool>(
          context: context,
          showDragHandle: true,
          builder: (context) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Kiểm tra phiếu sửa chữa',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '${asset?['assetCode'] ?? ''} · ${asset?['name'] ?? ''}',
                  ),
                  const SizedBox(height: 8),
                  Text(_descriptionController.text.trim()),
                  const SizedBox(height: 12),
                  const Text(
                    'Sau khi gửi, phiếu sẽ được chuyển đến Trưởng bộ phận.',
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Xác nhận gửi'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        )) ??
        false;
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
                        helperText: _assets.isEmpty
                            ? 'Không có tài sản phù hợp để tạo yêu cầu.'
                            : null,
                        suffixIcon: IconButton(
                          onPressed: _assets.isEmpty ? null : _scanQrCode,
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
                      onChanged: _assets.isEmpty
                          ? null
                          : (value) => setState(() => _assetId = value),
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
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _submitting || _assets.isEmpty
                                ? null
                                : () => _save(submit: false),
                            child: const Text('Lưu nháp'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: FilledButton.icon(
                            onPressed: _submitting || _assets.isEmpty
                                ? null
                                : () => _save(submit: true),
                            icon: _submitting
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.send_outlined),
                            label: const Text('Kiểm tra & gửi'),
                          ),
                        ),
                      ],
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

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';

class RepairMediaPreviewScreen extends StatefulWidget {
  const RepairMediaPreviewScreen({
    required this.file,
    required this.isVideo,
    super.key,
  });

  final XFile file;
  final bool isVideo;

  @override
  State<RepairMediaPreviewScreen> createState() =>
      _RepairMediaPreviewScreenState();
}

class _RepairMediaPreviewScreenState extends State<RepairMediaPreviewScreen> {
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

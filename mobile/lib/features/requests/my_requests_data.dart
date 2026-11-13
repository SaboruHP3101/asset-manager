import 'package:flutter/material.dart';

typedef MyRequestsLoader = Future<MyRequestsData> Function();

enum MyRequestType {
  repair('Sửa chữa', Icons.build_outlined),
  exchange('Đổi tài sản', Icons.swap_horiz),
  upgrade('Nâng cấp', Icons.upgrade),
  disposal('Báo phế', Icons.delete_outline),
  purchase('Đề nghị mua', Icons.shopping_cart_outlined);

  const MyRequestType(this.label, this.icon);

  final String label;
  final IconData icon;
}

class MyRequestItem {
  const MyRequestItem({
    required this.id,
    required this.type,
    required this.title,
    required this.reference,
    required this.status,
    required this.updatedAt,
  });

  final String id;
  final MyRequestType type;
  final String title;
  final String reference;
  final String status;
  final DateTime updatedAt;
}

class MyRequestsData {
  const MyRequestsData({required this.mine, required this.queue});

  final List<MyRequestItem> mine;
  final List<MyRequestItem> queue;
}

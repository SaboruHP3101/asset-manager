import { defineReadTool } from './read-tool.js';

export const myAssetsTool = defineReadTool(
  'assets',
  'Đọc tài sản đang giao cho chính người dùng đăng nhập. Dùng cho tài sản của tôi hoặc tôi có bao nhiêu tài sản. Backend cố định phạm vi cá nhân, không truyền scope. Tool không tự lọc trạng thái: đang sử dụng cần status=active, đang sửa cần status=repairing.',
  { name: 'read_my_assets', scope: 'mine' },
);

export const assetsTool = defineReadTool(
  'assets',
  'Tra cứu tài sản theo mã hoặc toàn bộ phạm vi được phép xem: danh sách, đếm, tổng nguyên giá, nhóm, CSV hoặc tuổi sử dụng. Với tài sản của tôi hoặc tôi có bao nhiêu tài sản, dùng read_my_assets.',
);

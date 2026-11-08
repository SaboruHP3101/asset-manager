import { defineReadTool } from './read-tool.js';

export const depreciationTool = defineReadTool(
  'depreciation',
  'Đọc dữ liệu khấu hao đã lưu. Mặc định kỳ recorded mới nhất; draft và pending_approval là dự kiến. Không tạo hay tính lại kỳ.',
);

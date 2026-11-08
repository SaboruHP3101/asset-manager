import { defineReadTool } from './read-tool.js';

export const repairsTool = defineReadTool(
  'repairs',
  'Tra cứu phiếu sửa chữa và chi phí. Dùng scope=queue cho việc chờ xử lý, mine cho phiếu do tôi tạo, allowed cho phạm vi được xem.',
);

import { defineReadTool } from './read-tool.js';

export const purchaseRequestsTool = defineReadTool(
  'purchase_requests',
  'Tra cứu đề nghị mua sắm. scope=queue là việc chờ xử lý, mine là phiếu do tôi tạo.',
);

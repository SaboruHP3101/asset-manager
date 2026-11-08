import { defineReadTool } from './read-tool.js';

export const warehouseTool = defineReadTool(
  'warehouse',
  'Tra cứu tài sản trong kho IT theo quyền hiện tại; hỗ trợ thời gian sử dụng từ ngày đưa vào sử dụng.',
);

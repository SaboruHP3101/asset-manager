import { defineReadTool } from './read-tool.js';

export const purchaseOrdersTool = defineReadTool(
  'purchase_orders',
  'Tra cứu đơn mua và tổng tiền gồm VAT trong phạm vi được phép.',
);

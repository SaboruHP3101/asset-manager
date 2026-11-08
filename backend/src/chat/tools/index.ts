import { assetsTool, myAssetsTool } from './assets.tool.js';
import { handoversTool } from './handovers.tool.js';
import { inventoryTool } from './inventory.tool.js';
import { repairsTool } from './repairs.tool.js';
import { purchaseRequestsTool } from './purchase-requests.tool.js';
import { purchaseOrdersTool } from './purchase-orders.tool.js';
import { warehouseTool } from './warehouse.tool.js';
import { depreciationTool } from './depreciation.tool.js';
import { permissionsTool } from './permissions.tool.js';

export const readTools = [
  myAssetsTool,
  assetsTool,
  handoversTool,
  inventoryTool,
  repairsTool,
  purchaseRequestsTool,
  purchaseOrdersTool,
  warehouseTool,
  depreciationTool,
  permissionsTool,
];

export const chatTools = readTools.map((tool) => tool.definition);

export function findReadTool(name: string) {
  return readTools.find((tool) => tool.definition.name === name);
}

import { defineReadTool } from './read-tool.js';

export const permissionsTool = defineReadTool(
  'permissions',
  'Xem quyền hiện tại của chính tài khoản đang đăng nhập.',
);

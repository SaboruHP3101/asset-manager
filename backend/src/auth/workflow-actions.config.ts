/**
 * Danh sách hành động được dùng bởi controller và guard. Quy tắc phân
 * quyền nằm tập trung tại file này để có thể rà soát hoặc thay đổi mà không sửa
 * logic nghiệp vụ trong từng service.
 */
export const WORKFLOW_ACTIONS = {
  purchaseSubmit: 'purchase.submit',
  purchaseApproveDepartment: 'purchase.approve_department',
  purchaseApproveFinance: 'purchase.approve_finance',
  purchaseApproveExecutive: 'purchase.approve_executive',
  purchaseCreateOrder: 'purchase.create_order',
  purchaseReceiveAssets: 'purchase.receive_assets',
  purchaseAllocateAssets: 'purchase.allocate_assets',
  transferCreate: 'transfer.create',
  transferApproveDepartment: 'transfer.approve_department',
  transferVerify: 'transfer.verify',
  transferConfirm: 'transfer.confirm',
  repairReport: 'repair.report',
  repairAssess: 'repair.assess',
  repairApproveDepartment: 'repair.approve_department',
  repairAssign: 'repair.assign',
  repairComplete: 'repair.complete',
  repairConfirmResult: 'repair.confirm_result',
} as const;

export type WorkflowAction =
  (typeof WORKFLOW_ACTIONS)[keyof typeof WORKFLOW_ACTIONS];

/**
 * Các thao tác tự phục vụ mà mọi nhân viên đang hoạt động đều cần có. Tách nhóm
 * này giúp vai trò chuyên môn vẫn có thể tạo yêu cầu cá nhân mà không lặp cấu hình.
 */
export const EMPLOYEE_ACTIONS: readonly WorkflowAction[] = [
  WORKFLOW_ACTIONS.purchaseSubmit,
  WORKFLOW_ACTIONS.transferCreate,
  WORKFLOW_ACTIONS.transferConfirm,
  WORKFLOW_ACTIONS.repairReport,
  WORKFLOW_ACTIONS.repairConfirmResult,
];

/**
 * Bảng này chỉ chứa quyền bổ sung theo chuyên môn. EMPLOYEE_ACTIONS được cộng
 * tự động cho mọi role đã cấu hình nên kế toán, IT hoặc thu mua vẫn dùng app cá nhân.
 */
export const ROLE_ACTIONS: Readonly<Record<string, readonly WorkflowAction[]>> =
  {
    'Nhân viên': [],
    'Kế toán': [WORKFLOW_ACTIONS.purchaseApproveFinance],
    'Điều hành': [WORKFLOW_ACTIONS.purchaseApproveExecutive],
    'Thu mua': [WORKFLOW_ACTIONS.purchaseCreateOrder],
    IT: [
      WORKFLOW_ACTIONS.purchaseReceiveAssets,
      WORKFLOW_ACTIONS.purchaseAllocateAssets,
      WORKFLOW_ACTIONS.transferVerify,
      WORKFLOW_ACTIONS.repairAssess,
      WORKFLOW_ACTIONS.repairAssign,
      WORKFLOW_ACTIONS.repairComplete,
    ],
  };

export const DEPARTMENT_HEAD_ACTIONS: readonly WorkflowAction[] = [
  WORKFLOW_ACTIONS.purchaseApproveDepartment,
  WORKFLOW_ACTIONS.transferApproveDepartment,
  WORKFLOW_ACTIONS.repairApproveDepartment,
];

/**
 * Tính danh sách quyền cuối cùng tại một nơi duy nhất để guard và /auth/me luôn
 * trả cùng kết quả. `new Set` loại bỏ quyền trùng khi một nhóm được mở rộng về sau.
 */
export function getAllowedWorkflowActions(
  roleName: string,
  isDepartmentHead: boolean,
): WorkflowAction[] {
  const roleActions = ROLE_ACTIONS[roleName];
  if (!roleActions) return [];

  return [
    ...new Set([
      ...EMPLOYEE_ACTIONS,
      ...roleActions,
      ...(isDepartmentHead ? DEPARTMENT_HEAD_ACTIONS : []),
    ]),
  ];
}

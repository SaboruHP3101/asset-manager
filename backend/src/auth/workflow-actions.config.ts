/**
 * Danh sách hành động được dùng bởi controller và guard. Quy tắc phân
 * quyền nằm tập trung tại file này để có thể rà soát hoặc thay đổi mà không sửa
 * logic nghiệp vụ trong từng service.
 */
export const WORKFLOW_ACTIONS = {
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
  purchaseRequestCreate: 'purchase.request.create',
  purchaseRequestUpdate: 'purchase.request.update',
  purchaseRequestSubmit: 'purchase.request.submit',
  purchaseRequestApproveDepartment: 'purchase.request.approve_department',
  purchaseRequestEnrichProcurement: 'purchase.request.enrich_procurement',
  purchaseRequestApproveProcurement: 'purchase.request.approve_procurement',
  purchaseRequestApproveIt: 'purchase.request.approve_it',
  purchaseOrderCreate: 'purchase.order.create',
  purchaseOrderSubmit: 'purchase.order.submit',
  purchaseOrderApprove: 'purchase.order.approve',
  purchaseOrderCancel: 'purchase.order.cancel',
  purchaseReceiptRecord: 'purchase.receipt.record',
  purchaseReceiptInspectIt: 'purchase.receipt.inspect_it',
  purchaseReceiptInspectProcurement: 'purchase.receipt.inspect_procurement',
  purchaseReceiptCloseShort: 'purchase.receipt.close_short',
  purchaseAllocationCreateInitial: 'purchase.allocation.create_initial',
  purchaseAllocationReallocateIt: 'purchase.allocation.reallocate_it',
  purchaseAllocationReallocateProcurement:
    'purchase.allocation.reallocate_procurement',
  purchaseAllocationConfirmDepartment: 'purchase.allocation.confirm_department',
  purchaseAllocationConfirmRecipient: 'purchase.allocation.confirm_recipient',
} as const;

export type WorkflowAction =
  (typeof WORKFLOW_ACTIONS)[keyof typeof WORKFLOW_ACTIONS];

/**
 * Các thao tác tự phục vụ mà mọi nhân viên đang hoạt động đều cần có. Tách nhóm
 * này giúp vai trò chuyên môn vẫn có thể tạo yêu cầu cá nhân mà không lặp cấu hình.
 */
export const EMPLOYEE_ACTIONS: readonly WorkflowAction[] = [
  WORKFLOW_ACTIONS.transferCreate,
  WORKFLOW_ACTIONS.transferConfirm,
  WORKFLOW_ACTIONS.repairReport,
  WORKFLOW_ACTIONS.repairConfirmResult,
  WORKFLOW_ACTIONS.purchaseRequestCreate,
  WORKFLOW_ACTIONS.purchaseRequestUpdate,
  WORKFLOW_ACTIONS.purchaseRequestSubmit,
  WORKFLOW_ACTIONS.purchaseAllocationConfirmRecipient,
];

/**
 * Bảng này chỉ chứa quyền bổ sung theo chuyên môn. EMPLOYEE_ACTIONS được cộng
 * cho mọi nhân viên, kể cả role mới chưa được khai báo trong bảng này.
 */
export const ROLE_ACTIONS: Readonly<Record<string, readonly WorkflowAction[]>> =
  {
    EMPLOYEE: [],
    ACCOUNTING: [],
    EXECUTIVE: [],
    PROCUREMENT: [],
    IT: [
      WORKFLOW_ACTIONS.transferVerify,
      WORKFLOW_ACTIONS.repairAssess,
      WORKFLOW_ACTIONS.repairAssign,
      WORKFLOW_ACTIONS.repairComplete,
    ],
  };

export const DEPARTMENT_HEAD_ACTIONS: readonly WorkflowAction[] = [
  WORKFLOW_ACTIONS.transferApproveDepartment,
  WORKFLOW_ACTIONS.repairApproveDepartment,
  WORKFLOW_ACTIONS.purchaseRequestApproveDepartment,
  WORKFLOW_ACTIONS.purchaseAllocationCreateInitial,
  WORKFLOW_ACTIONS.purchaseAllocationConfirmDepartment,
];

const DEPARTMENT_ACTIONS: Readonly<Record<string, readonly WorkflowAction[]>> =
  {
    PROCUREMENT: [
      WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
      WORKFLOW_ACTIONS.purchaseOrderCreate,
      WORKFLOW_ACTIONS.purchaseOrderSubmit,
      WORKFLOW_ACTIONS.purchaseReceiptRecord,
      WORKFLOW_ACTIONS.purchaseReceiptInspectProcurement,
      WORKFLOW_ACTIONS.purchaseAllocationReallocateProcurement,
    ],
    IT: [
      WORKFLOW_ACTIONS.purchaseReceiptInspectIt,
      WORKFLOW_ACTIONS.purchaseAllocationReallocateIt,
    ],
  };

const DEPARTMENT_HEAD_PURCHASE_ACTIONS: Readonly<
  Record<string, readonly WorkflowAction[]>
> = {
  PROCUREMENT: [
    WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
    WORKFLOW_ACTIONS.purchaseOrderApprove,
    WORKFLOW_ACTIONS.purchaseOrderCancel,
    WORKFLOW_ACTIONS.purchaseReceiptCloseShort,
  ],
  IT: [WORKFLOW_ACTIONS.purchaseRequestApproveIt],
};

/**
 * Tính danh sách quyền cuối cùng tại một nơi duy nhất để guard và /auth/me luôn
 * trả cùng kết quả. `new Set` loại bỏ quyền trùng khi một nhóm được mở rộng về sau.
 */
export function getAllowedWorkflowActions(
  roleName: string,
  isDepartmentHead: boolean,
  departmentName?: string,
): WorkflowAction[] {
  const roleActions = ROLE_ACTIONS[roleName] ?? [];
  const departmentActions = departmentName
    ? (DEPARTMENT_ACTIONS[departmentName] ?? [])
    : [];
  const departmentHeadPurchaseActions =
    isDepartmentHead && departmentName
      ? (DEPARTMENT_HEAD_PURCHASE_ACTIONS[departmentName] ?? [])
      : [];

  return [
    ...new Set([
      ...EMPLOYEE_ACTIONS,
      ...roleActions,
      ...departmentActions,
      ...(isDepartmentHead ? DEPARTMENT_HEAD_ACTIONS : []),
      ...departmentHeadPurchaseActions,
    ]),
  ];
}

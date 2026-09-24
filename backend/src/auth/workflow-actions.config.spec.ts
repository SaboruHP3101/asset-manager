import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
} from './workflow-actions.config.js';

const seedAccounts = [
  ['NV001', 'IT', 'IT', true],
  ['NV002', 'ACCOUNTING', 'ACCOUNTING', true],
  ['NV003', 'EMPLOYEE', 'WAREHOUSE', true],
  ['NV004', 'PROCUREMENT', 'PROCUREMENT', false],
  ['NV005', 'EMPLOYEE', 'IT', false],
  ['NV006', 'EXECUTIVE', 'EXECUTIVE', false],
  ['NV007', 'PROCUREMENT', 'PROCUREMENT', true],
  ['NV008', 'EMPLOYEE', 'WAREHOUSE', false],
] as const;

describe('seed account purchase actions', () => {
  it.each(seedAccounts)(
    '%s luôn có action tự phục vụ',
    (_code, role, department, isHead) => {
      const actions = getAllowedWorkflowActions(role, isHead, department);
      expect(actions).toEqual(
        expect.arrayContaining([
          WORKFLOW_ACTIONS.purchaseRequestCreate,
          WORKFLOW_ACTIONS.purchaseRequestUpdate,
          WORKFLOW_ACTIONS.purchaseRequestSubmit,
        ]),
      );
    },
  );

  it('cấp đúng action chuyên môn theo department và cờ trưởng phòng', () => {
    const itHead = getAllowedWorkflowActions('IT', true, 'IT');
    const procurementStaff = getAllowedWorkflowActions(
      'PROCUREMENT',
      false,
      'PROCUREMENT',
    );
    const procurementHead = getAllowedWorkflowActions(
      'PROCUREMENT',
      true,
      'PROCUREMENT',
    );

    expect(itHead).toContain(WORKFLOW_ACTIONS.purchaseRequestApproveIt);
    expect(procurementStaff).toContain(
      WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
    );
    expect(procurementHead).toContain(
      WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
    );
  });

  it('không cấp action duyệt chuyên môn cho Accounting và Executive', () => {
    for (const [role, department, isHead] of [
      ['ACCOUNTING', 'ACCOUNTING', true],
      ['EXECUTIVE', 'EXECUTIVE', false],
    ] as const) {
      const actions = getAllowedWorkflowActions(role, isHead, department);
      expect(actions).not.toContain(
        WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
      );
      expect(actions).not.toContain(WORKFLOW_ACTIONS.purchaseRequestApproveIt);
    }
  });
});

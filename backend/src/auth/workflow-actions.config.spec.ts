import {
  getAllowedWorkflowActions,
  WORKFLOW_ACTIONS,
} from './workflow-actions.config.js';

const seedAccounts = [
  ['NV001', 'IT', true],
  ['NV002', 'ACCOUNTING', true],
  ['NV003', 'WAREHOUSE', true],
  ['NV004', 'PROCUREMENT', false],
  ['NV005', 'IT', false],
  ['NV006', 'EXECUTIVE', false],
  ['NV007', 'PROCUREMENT', true],
  ['NV008', 'WAREHOUSE', false],
] as const;

describe('seed account purchase actions', () => {
  it.each([
    WORKFLOW_ACTIONS.transferVerify,
    WORKFLOW_ACTIONS.repairAssess,
    WORKFLOW_ACTIONS.repairAssign,
  ])('grants %s by IT department membership, not head status', (action) => {
    expect(getAllowedWorkflowActions(false, 'IT')).toContain(action);
    expect(getAllowedWorkflowActions(true, 'IT')).toContain(action);
    expect(getAllowedWorkflowActions(false, 'WAREHOUSE')).not.toContain(action);
    expect(getAllowedWorkflowActions(true, 'WAREHOUSE')).not.toContain(action);
    expect(getAllowedWorkflowActions(false)).not.toContain(action);
  });

  it('grants repair completion to the IT department', () => {
    expect(getAllowedWorkflowActions(false, 'IT')).toContain(
      WORKFLOW_ACTIONS.repairComplete,
    );
    expect(getAllowedWorkflowActions(true, 'IT')).toContain(
      WORKFLOW_ACTIONS.repairComplete,
    );
    expect(getAllowedWorkflowActions(false, 'WAREHOUSE')).not.toContain(
      WORKFLOW_ACTIONS.repairComplete,
    );
  });

  it('separates Accounting preparation from head approval by department', () => {
    const staff = getAllowedWorkflowActions(false, 'ACCOUNTING');
    const head = getAllowedWorkflowActions(true, 'ACCOUNTING');
    const moved = getAllowedWorkflowActions(true, 'IT');

    expect(staff).toContain(WORKFLOW_ACTIONS.depreciationPrepare);
    expect(staff).not.toContain(WORKFLOW_ACTIONS.depreciationApprove);
    expect(head).toContain(WORKFLOW_ACTIONS.depreciationApprove);
    expect(head).not.toContain(WORKFLOW_ACTIONS.depreciationPrepare);
    expect(moved).not.toContain(WORKFLOW_ACTIONS.depreciationView);
  });
  it.each(seedAccounts)(
    '%s luôn có action tự phục vụ',
    (_code, department, isHead) => {
      const actions = getAllowedWorkflowActions(isHead, department);

      expect(actions).toEqual(
        expect.arrayContaining([
          WORKFLOW_ACTIONS.purchaseRequestCreate,
          WORKFLOW_ACTIONS.purchaseRequestUpdate,
          WORKFLOW_ACTIONS.purchaseRequestDeleteDraft,
          WORKFLOW_ACTIONS.purchaseRequestSubmit,
          WORKFLOW_ACTIONS.assetRecallCreate,
          WORKFLOW_ACTIONS.assetRecallUpdate,
          WORKFLOW_ACTIONS.assetRecallSubmit,
          WORKFLOW_ACTIONS.assetRecallConfirmHandover,
          WORKFLOW_ACTIONS.assetRecallConfirmUpgradeReturn,
          WORKFLOW_ACTIONS.repairUpdate,
          WORKFLOW_ACTIONS.repairSubmit,
          WORKFLOW_ACTIONS.repairConfirmHandover,
        ]),
      );
    },
  );

  it('cấp đúng action chuyên môn theo department và cờ trưởng phòng', () => {
    const itHead = getAllowedWorkflowActions(true, 'IT');
    const procurementStaff = getAllowedWorkflowActions(false, 'PROCUREMENT');
    const procurementHead = getAllowedWorkflowActions(true, 'PROCUREMENT');

    expect(itHead).toContain(WORKFLOW_ACTIONS.purchaseRequestApproveIt);
    expect(itHead).toContain(WORKFLOW_ACTIONS.assetRecallApproveIt);
    expect(itHead).toContain(WORKFLOW_ACTIONS.assetRecallCompleteDisposal);
    expect(itHead).toContain(WORKFLOW_ACTIONS.assetRecallProcessUpgrade);
    expect(itHead).toContain(WORKFLOW_ACTIONS.repairApproveIt);
    expect(itHead).toContain(WORKFLOW_ACTIONS.warehouseItView);
    expect(procurementStaff).toContain(
      WORKFLOW_ACTIONS.purchaseRequestEnrichProcurement,
    );
    expect(procurementHead).toContain(
      WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
    );
  });

  it('không cấp action duyệt chuyên môn cho Accounting và Executive', () => {
    for (const [department, isHead] of [
      ['ACCOUNTING', true],
      ['EXECUTIVE', false],
    ] as const) {
      const actions = getAllowedWorkflowActions(isHead, department);

      expect(actions).not.toContain(
        WORKFLOW_ACTIONS.purchaseRequestApproveProcurement,
      );
      expect(actions).not.toContain(WORKFLOW_ACTIONS.purchaseRequestApproveIt);
      expect(actions).not.toContain(WORKFLOW_ACTIONS.assetRecallApproveIt);
      expect(actions).not.toContain(WORKFLOW_ACTIONS.warehouseItView);
    }
  });
});

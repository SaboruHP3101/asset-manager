import { validate } from 'class-validator';
import {
  CompleteRepairDto,
  ConfirmRepairDto,
  RepairCostMonthDto,
  RepairDecisionDto,
  RepairHandoverDecisionDto,
} from './repair-workflow.dto.js';

describe('repair workflow DTOs', () => {
  it.each(['0', '1000000', undefined])('chấp nhận chi phí %s', async (cost) => {
    const dto = Object.assign(new CompleteRepairDto(), {
      resultNotes: 'Đã thay linh kiện',
      actualCost: cost,
    });

    expect(await validate(dto)).toEqual([]);
  });

  it.each(['-1', '1.5', '1e6', '', '1000000000000000'])('từ chối chi phí %s', async (cost) => {
    const dto = Object.assign(new CompleteRepairDto(), {
      resultNotes: 'Đã thay linh kiện',
      actualCost: cost,
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(['actualCost']);
  });

  it.each([['2026-11', true], ['2026-13', false], [undefined, false]])(
    'kiểm tra tháng báo cáo %s',
    async (month, valid) => {
      const dto = Object.assign(new RepairCostMonthDto(), { month });
      const errors = await validate(dto);

      expect(errors.length === 0).toBe(valid);
    },
  );

  it('bắt buộc lý do khi từ chối approval', async () => {
    const dto = new RepairDecisionDto();

    dto.approved = false;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'note')).toBe(true);
  });

  it('bắt buộc lý do khi từ chối bàn giao', async () => {
    const dto = new RepairHandoverDecisionDto();

    dto.confirmed = false;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'note')).toBe(true);
  });

  it('bắt buộc lý do khi từ chối kết quả sửa chữa', async () => {
    const dto = new ConfirmRepairDto();

    dto.accepted = false;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'note')).toBe(true);
  });
});

import { validate } from 'class-validator';
import {
  ConfirmRepairDto,
  RepairDecisionDto,
  RepairHandoverDecisionDto,
} from './repair-workflow.dto.js';

describe('repair workflow DTOs', () => {
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

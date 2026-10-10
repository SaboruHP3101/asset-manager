import { validate } from 'class-validator';
import {
  CreateAssetRecallRequestDto,
  ItRecallDecisionDto,
  RecallHandoverDecisionDto,
} from './asset-recall-request.dto.js';

describe('asset recall DTOs', () => {
  it('cho phép lưu draft chưa có reason', async () => {
    const dto = new CreateAssetRecallRequestDto();

    dto.assetId = '550e8400-e29b-41d4-a716-446655440000';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('bắt buộc replacement asset khi Trưởng IT duyệt', async () => {
    const dto = new ItRecallDecisionDto();

    dto.approved = true;

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'replacementAssetId'),
    ).toBe(true);
  });

  it('bắt buộc reason khi từ chối bàn giao', async () => {
    const dto = new RecallHandoverDecisionDto();

    dto.confirmed = false;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });
});

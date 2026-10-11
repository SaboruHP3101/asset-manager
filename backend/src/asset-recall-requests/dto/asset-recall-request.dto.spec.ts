import { validate } from 'class-validator';
import {
  CompleteDisposalDto,
  CreateAssetRecallRequestDto,
  RecallHandoverDecisionDto,
} from './asset-recall-request.dto.js';

describe('asset recall DTOs', () => {
  it('cho phép lưu draft chưa có reason', async () => {
    const dto = new CreateAssetRecallRequestDto();

    dto.assetId = '550e8400-e29b-41d4-a716-446655440000';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('chỉ cho phép loại recall đang hỗ trợ', async () => {
    const dto = new CreateAssetRecallRequestDto();

    dto.assetId = '550e8400-e29b-41d4-a716-446655440000';
    dto.type = 'disposal';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('cho phép tạo phiếu nâng cấp', async () => {
    const dto = new CreateAssetRecallRequestDto();

    dto.assetId = '550e8400-e29b-41d4-a716-446655440000';
    dto.type = 'upgrade';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('bắt buộc reason khi từ chối bàn giao', async () => {
    const dto = new RecallHandoverDecisionDto();

    dto.confirmed = false;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('bắt buộc ngày và phương thức khi hoàn tất báo phế', async () => {
    const dto = new CompleteDisposalDto();

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'disposalDate')).toBe(
      true,
    );
    expect(errors.some((error) => error.property === 'disposalMethod')).toBe(
      true,
    );
  });
});

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssetAllocationDecisionDto } from './asset-allocation.dto.js';

describe('Asset allocation DTO', () => {
  it('bắt buộc lý do có nội dung khi từ chối', async () => {
    const rejected = plainToInstance(AssetAllocationDecisionDto, {
      confirmed: false,
      reason: '   ',
    });
    const confirmed = plainToInstance(AssetAllocationDecisionDto, {
      confirmed: true,
    });

    expect(await validate(rejected)).not.toHaveLength(0);
    expect(await validate(confirmed)).toHaveLength(0);
  });
});

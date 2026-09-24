import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PurchaseRequestDecisionDto,
  SavePurchaseRequestDto,
} from './purchase-request.dto.js';

describe('Purchase request DTO', () => {
  it('validate nested items và từ chối danh sách trống', async () => {
    const dto = plainToInstance(SavePurchaseRequestDto, {
      neededByDate: '2026-10-15',
      purpose: 'Trang bị nhân viên mới',
      items: [],
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('bắt buộc lý do khi từ chối', async () => {
    const rejected = plainToInstance(PurchaseRequestDecisionDto, {
      approved: false,
    });
    const approved = plainToInstance(PurchaseRequestDecisionDto, {
      approved: true,
    });

    expect(await validate(rejected)).not.toHaveLength(0);
    expect(await validate(approved)).toHaveLength(0);
  });
});

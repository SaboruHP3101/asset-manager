import { BadRequestException } from '@nestjs/common';

export interface ReceiptProgressLine {
  ordered: number;
  delivered: number;
  accepted: number;
  rejected: number;
  pending: number;
  remaining: number;
}

export function calculateReceiptProgress(
  ordered: number,
  delivered: number,
  accepted: number,
  rejected: number,
): ReceiptProgressLine {
  const pending = delivered - accepted - rejected;

  return {
    ordered,
    delivered,
    accepted,
    rejected,
    pending,
    remaining: ordered - accepted - pending,
  };
}

export function validateReceiptSerialNumbers(
  serialNumbers: string[] | undefined,
  deliveredQuantity: number,
  requiresSerials: boolean,
  itemName: string,
): string[] {
  const values = serialNumbers ?? [];
  const normalized = values.map((serial) => serial.trim());

  if (normalized.some((serial) => serial.length === 0)) {
    throw new BadRequestException(
      `Mã sản phẩm của ${itemName} không được để trống.`,
    );
  }

  if (new Set(normalized).size !== normalized.length) {
    throw new BadRequestException(
      `Danh sách mã sản phẩm của ${itemName} có mã bị trùng.`,
    );
  }

  if (normalized.length > deliveredQuantity) {
    throw new BadRequestException(
      `Số mã sản phẩm của ${itemName} vượt số lượng giao.`,
    );
  }

  if (requiresSerials && normalized.length !== deliveredQuantity) {
    throw new BadRequestException(
      `${itemName} cần đủ ${deliveredQuantity} mã sản phẩm.`,
    );
  }

  return normalized;
}

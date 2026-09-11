import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePurchaseContractDto {
  /** Số hợp đồng duy nhất. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contractNumber: string;

  /** UUID của nhà cung cấp. */
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  /** Ngày ký hợp đồng theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  signedDate: string;

  /** Ngày có hiệu lực theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  effectiveDate: string;

  /** Ngày hết hạn theo định dạng ISO 8601. */
  @IsDateString()
  @IsNotEmpty()
  expirationDate: string;

  /** Giá trị hợp đồng dưới dạng chuỗi số thập phân. */
  @IsNumberString()
  @IsNotEmpty()
  contractValue: string;

  /** Trạng thái. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status: string;
}

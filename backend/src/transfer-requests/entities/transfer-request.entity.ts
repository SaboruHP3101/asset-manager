/**
 * Resource trả về của API điều chuyển. Constructor nhận bản ghi Drizzle để tách
 * kiểu phản hồi HTTP khỏi chi tiết triển khai truy vấn trong service.
 */
export class TransferRequest {
  constructor(partial: Partial<TransferRequest>) {
    Object.assign(this, partial);
  }
}

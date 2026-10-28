import {
  addMonths as addCalendarMonths,
  differenceInCalendarDays,
  formatISO,
  getDaysInMonth,
  lastDayOfMonth,
  parseISO,
  startOfMonth,
  subDays,
  subMinutes,
} from 'date-fns';
import type { assetDepreciationProfiles } from '../db/schema.js';

type Profile = typeof assetDepreciationProfiles.$inferSelect;

/**
 * Lấy ngày đầu tháng của `date`.
 * Ví dụ: 2026-12-24 -> 2026-12-01
 */
export function monthOf(date: string): string {
  return formatISO(startOfMonth(parseISO(date)), { representation: 'date' });
}

/**
 * Cộng thêm n tháng vào `date`.
 * Ví dụ: 2026-09-24 + 1 tháng -> 2026-10-24
 */
export function addMonths(date: string, months: number): string {
  return formatISO(addCalendarMonths(parseISO(date), months), {
    representation: 'date',
  });
}

/**
 * Xác định kỳ đến hạn của tháng vừa rồi.
 * Ví dụ: 2026-11-01 00:05 -> 2026-10-01
 */
export function lastDueMonth(now: Date): string {
  const month = startOfMonth(subMinutes(now, 5));

  return formatISO(addCalendarMonths(month, -1), { representation: 'date' });
}

/**
 * Tính khấu hao cho một tài sản trong một tháng
 * @param profile cấu hình tài sản
 * @param month kỳ cần tính, ví dụ 2026-10-01
 * @param openingValue số dư đầu kỳ
 * @returns
 */
export function calculateDepreciation(
  profile: Profile,
  month: string,
  openingValue: string,
) {
  // Ngày bắt đầu phần khấu hao mà hệ thống sẽ quản lý
  // với `startDate` là ngày tài sản bắt đầu khấu hao; và
  // `firstMonth` tháng Kế toán bắt đầu đưa tài sản vào luồng này.
  // Ví dụ: máy in được sử dụng từ  01/05/2026 nhưng tới tháng 01/09/2026
  // mới được đưa vào hệ thống thì `start` sẽ là tháng 01/09/2026
  const start =
    profile.startDate > profile.firstMonth
      ? profile.startDate
      : profile.firstMonth;

  // Mốc kết thúc với phần thời gian còn lại
  const end = addMonths(start, profile.remainingMonths);

  const periodMonth = parseISO(month);

  // Xác định ngày bắt đầu tính trong tháng
  // Ví dụ: tháng tính là 09/2026
  // 1. Tài sản bắt đầu sử dụng từ 16/09/2026 -> `from` sẽ là 16/09/2026
  // 2. Tài sản bắt đầu sử dụng từ 03/08/2026 -> `from` sẽ là 01/09/2026
  // => Chọn ngày muộn hơn để tránh tính trước ngày bắt đầu hoặc tính vào của tháng trước
  const from = start > month ? start : month;

  // Lấy ngày cuối tháng
  const monthLast = formatISO(lastDayOfMonth(periodMonth), {
    representation: 'date',
  });

  // Lấy ngày cuối lịch khấu hao, vì `end` là mốc không bao gồm ngày đó nên phải trừ một ngày
  const naturalLast = formatISO(subDays(parseISO(end), 1), {
    representation: 'date',
  });

  // Chọn ngày kết thúc sớm nhất
  // monthLast: ngày cuối của tháng đang tính.
  // naturalLast: ngày cuối lịch khấu hao.
  // stopDate: ngày dừng sớm do Kế toán cấu hình.
  const to = [monthLast, naturalLast, profile.stopDate ?? monthLast].sort()[0];

  // Chỉnh qua BigInt để tính toán chính xác
  const opening = BigInt(openingValue);

  // Kiểm tra tài sản có cần tính khấu hao trong tháng đang xét không:
  // month < profile.firstMonth: chưa đến tháng bắt đầu quản lý.
  // from > to: không có khoảng ngày hợp lệ để tính.
  // opening === 0n: không còn tiền để khấu hao.
  if (month < profile.firstMonth || from > to || opening === 0n) return null;

  // Khấu hao kỳ = Nguyên giá ÷ Tổng thời hạn x Số ngày được tính ÷ Số ngày của tháng
  // Nếu tháng đó không đủ ngày, ví dụ từ 16/09/2026:
  // `from` là 16/09/2026, `to` là 30/09/2026 (15 ngày),
  // với máy in 12.000.000 đ
  // 1. Mỗi tháng khấu hao: 12.000.000 / 12 = 1.000.000 đ
  // 2. Khấu hao tháng 9: 1.000.000 x 15 / 30 = 500.000 đ

  // Lấy số ngày để tính, từ `from` đến `to`,
  // do `differenceInCalendarDays` chỉ trả về khoảng cách giữa hai ngày nên phải +1
  const days = BigInt(
    differenceInCalendarDays(parseISO(to), parseISO(from)) + 1,
  );

  // Lấy số ngày thực tế của tháng tính, ví dụ:
  // - Tháng 9: 30 ngày.
  // - Tháng 10: 31 ngày.
  // - Tháng 2: 28 hoặc 29 ngày.
  // Đổi sang BigInt để các phép tính tiền được chính xác
  const daysInMonth = BigInt(getDaysInMonth(periodMonth));
  const originalCostTimesDays = BigInt(profile.originalCost) * days;
  const termMonthsTimesDaysInMonth = BigInt(profile.termMonths) * daysInMonth;

  // Làm tròn số tiền bằng cách cộng nửa mẫu số trước khi chia,
  // do phép chia BigInt bỏ qua phần thập phân
  let amount =
    (originalCostTimesDays + termMonthsTimesDaysInMonth / 2n) /
    termMonthsTimesDaysInMonth;

  // Nếu đây là kỳ cuối, lấy hết giá trị còn lại
  if (to === naturalLast) {
    amount = opening;
  }

  // Không cho tiền khấu hao vượt giá trị còn lại
  // Tiền khấu hao vừa tính: 500.000 đ
  // Giá trị còn lại đầu kỳ: 200.000 đ
  // Nếu lấy 500.000 đ thì sẽ bị âm 300.000 đ
  if (amount > opening) {
    amount = opening;
  }

  return {
    fromDate: from,
    toDate: to,
    openingValue,
    depreciationAmount: amount.toString(),
    remainingValue: (opening - amount).toString(),
  };
}

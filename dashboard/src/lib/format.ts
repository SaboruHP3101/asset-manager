const timeZone = "Asia/Ho_Chi_Minh";

const monthFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone,
  year: "numeric",
  month: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone,
  dateStyle: "short",
});

const currencyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 2,
});

export function formatVietnamMonth(date: Date) {
  return monthFormat.format(date);
}

export function isValidYearMonth(value: string) {
  return /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
}

export function formatVietnamDate(date: Date) {
  return dateFormat.format(date);
}

export function formatVnd(amount: number | bigint | `${number}`) {
  return currencyFormat.format(amount);
}

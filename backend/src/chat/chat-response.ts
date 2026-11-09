import {
  formatISO,
  intervalToDuration,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import type {
  ChatQueryDto,
  ChatRecord,
  ChatReply,
  ChatRow,
} from './chat.dto.js';

const labels: Record<string, string> = {
  assetCode: 'Mã tài sản',
  code: 'Mã phiếu',
  name: 'Tên',
  status: 'Trạng thái',
  category: 'Loại tài sản',
  department: 'Phòng ban',
  assignedTo: 'Người phụ trách / sử dụng',
  supplier: 'Nhà cung cấp',
  location: 'Vị trí đã ghi nhận',
  initialValue: 'Nguyên giá',
  date: 'Ngày / kỳ',
  inServiceDate: 'Ngày đưa vào sử dụng',
  usageDuration: 'Thời gian từ ngày đưa vào sử dụng',
  completedAt: 'Ngày hoàn tất',
  completionDate: 'Ngày hoàn tất kiểm kê',
  description: 'Nội dung',
  requester: 'Người đề nghị',
  neededByDate: 'Ngày cần',
  expectedDeliveryDate: 'Ngày giao dự kiến',
  repairCost: 'Chi phí sửa chữa đã ghi nhận',
  totalInclVat: 'Tổng PO gồm VAT',
  depreciationAmount: 'Khấu hao kỳ',
  originalCost: 'Nguyên giá đã xác nhận',
  openingValue: 'Giá trị đầu kỳ',
  remainingValue: 'Giá trị cuối kỳ',
  termMonths: 'Thời hạn khấu hao (tháng)',
  method: 'Phương pháp',
  type: 'Loại bàn giao',
  action: 'Mã quyền',
};

const statuses: Record<string, string> = {
  active: 'Đang sử dụng',
  in_use: 'Đang sử dụng',
  using: 'Đang sử dụng',
  available: 'Sẵn sàng',
  repairing: 'Đang sửa chữa',
  draft: 'Bản nháp',
  pending_department_head: 'Chờ Trưởng phòng',
  pending_it_head: 'Chờ Trưởng IT',
  pending_procurement_enrichment: 'Chờ Thu mua bổ sung',
  pending_procurement_head: 'Chờ Trưởng Thu mua',
  approved: 'Đã duyệt',
  revision_required: 'Cần chỉnh sửa',
  ordering: 'Đang đặt mua',
  fully_ordered: 'Đã đặt đủ',
  issued: 'Đã phát hành',
  partially_received: 'Đã nhận một phần',
  fully_received: 'Đã nhận đủ',
  closed_short: 'Đã đóng thiếu',
  cancelled: 'Đã hủy',
  in_progress: 'Đang xử lý',
  pending_handover_confirmations: 'Chờ xác nhận bàn giao',
  ready_for_return: 'Chờ nhận lại',
  closed: 'Đã đóng',
  completed: 'Hoàn tất',
  recorded: 'Đã ghi nhận',
  pending_approval: 'Chờ duyệt',
};

const moneyFields = new Set([
  'initialValue',
  'repairCost',
  'depreciationAmount',
  'remainingValue',
  'openingValue',
  'originalCost',
  'totalInclVat',
]);

function formatMoney(value: string): string {
  const [integer, fraction = ''] = value.split('.');
  const decimals = fraction.replace(/0+$/, '');

  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimals ? `,${decimals}` : ''} ₫`;
}

export function sumMoney(values: string[]): string {
  const scale = Math.max(
    0,
    ...values.map((value) => (value.split('.')[1] ?? '').length),
  );
  const total = values.reduce((sum, value) => {
    const [integer, fraction = ''] = value.split('.');

    return sum + BigInt(`${integer}${fraction.padEnd(scale, '0')}`);
  }, 0n);
  const sign = total < 0n ? '-' : '';
  const digits = (total < 0n ? -total : total)
    .toString()
    .padStart(scale + 1, '0');

  return `${sign}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`;
}

function display(key: string, value: string | number | Date | null): string {
  if (value === null) return 'Chưa ghi nhận';

  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (moneyFields.has(key)) return formatMoney(String(value));

  if (key === 'status') return statuses[String(value)] ?? String(value);

  return String(value);
}

function row(record: ChatRecord): ChatRow {
  const imageUrl = record.imageUrl;

  return {
    title: String(
      record.assetCode ?? record.code ?? record.name ?? 'Thông tin',
    ),
    fields: Object.entries(record)
      .filter(([key]) => key !== 'id' && key !== 'imageUrl')
      .map(([key, value]) => ({
        label: labels[key] ?? key,
        value: display(key, value),
      })),
    ...(typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/')
      ? { imageUrl }
      : {}),
  };
}

function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;

  return `"${safe.replace(/"/g, '""')}"`;
}

function usageDuration(value: ChatRecord[string], today: Date): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'Chưa có ngày đưa vào sử dụng hợp lệ';
  }

  const start = parseISO(value);

  if (!isValid(start)) return 'Chưa có ngày đưa vào sử dụng hợp lệ';

  if (start > today) return 'Ngày đưa vào sử dụng nằm trong tương lai';

  const {
    years = 0,
    months = 0,
    days = 0,
  } = intervalToDuration({ start, end: today });

  return `${years} năm ${months} tháng ${days} ngày`;
}

export function buildChatReply(
  query: ChatQueryDto,
  records: ChatRecord[],
  source: string,
  scope: string,
): ChatReply {
  const reply: ChatReply = {
    message: '',
    source,
    scope,
    asOf: new Date().toISOString(),
    total: records.length,
    hasMore: false,
    rows: [],
  };

  if (records.length > 2000) {
    return {
      ...reply,
      total: null,
      message:
        'Có hơn 2.000 bản ghi phù hợp. Vui lòng thêm mã, trạng thái hoặc khoảng ngày để có kết quả đầy đủ.',
    };
  }

  if (!records.length) {
    return {
      ...reply,
      message:
        'Không tìm thấy bản ghi phù hợp trong phạm vi bạn được phép xem.',
    };
  }

  if (query.operation === 'usage_duration') {
    if (!['assets', 'warehouse'].includes(query.domain)) {
      return {
        ...reply,
        message: 'Thời gian sử dụng cần đọc dữ liệu tài sản.',
      };
    }

    const today = startOfDay(new Date(reply.asOf));
    const selected = records.slice(query.offset, query.offset + query.limit);
    const rows = selected.map((record) =>
      row({
        assetCode: record.assetCode ?? null,
        name: record.name ?? null,
        inServiceDate: record.inServiceDate ?? null,
        usageDuration: usageDuration(record.inServiceDate, today),
      }),
    );

    return {
      ...reply,
      message: `Tính từ ngày đưa vào sử dụng đến ${formatISO(today, { representation: 'date' })}; không đo thời gian thiết bị hoạt động thực tế.`,
      hasMore: records.length > query.offset + query.limit,
      rows,
    };
  }

  if (query.operation === 'count') {
    return {
      ...reply,
      message: `Có ${records.length} bản ghi phù hợp trong phạm vi này.`,
    };
  }

  if (query.operation === 'sum') {
    if (
      !moneyFields.has(query.metric) ||
      !records.some((record) => query.metric in record)
    ) {
      return {
        ...reply,
        message:
          'Chưa hỗ trợ phép tính này trên dữ liệu được chọn. Vui lòng nêu rõ loại số tiền cần tổng hợp.',
      };
    }

    if (
      query.domain === 'depreciation' &&
      ['remainingValue', 'originalCost'].includes(query.metric) &&
      new Set(records.map((record) => record.date)).size > 1
    ) {
      return {
        ...reply,
        message:
          'Vui lòng chọn một kỳ khấu hao để tổng hợp giá trị tài sản, tránh cộng lặp giá trị của nhiều kỳ.',
      };
    }

    const values = records
      .map((record) => record[query.metric])
      .filter((value) => value !== null && value !== undefined)
      .map(String);

    if (!values.length)
      return {
        ...reply,
        message: 'Chưa có số tiền được ghi nhận cho các bản ghi này.',
      };

    return {
      ...reply,
      message: `${labels[query.metric]}: ${formatMoney(sumMoney(values))}. Có số tiền ở ${values.length}/${records.length} bản ghi.`,
    };
  }

  if (query.operation === 'group') {
    if (!records.some((record) => query.groupBy in record)) {
      return {
        ...reply,
        message: 'Dữ liệu này chưa hỗ trợ cách phân nhóm được yêu cầu.',
      };
    }

    if (query.metric !== 'count') {
      return {
        ...reply,
        message:
          'Hiện chỉ phân nhóm theo số bản ghi. Để tổng hợp số tiền, vui lòng chọn một nhóm bằng bộ lọc rồi hỏi tổng tiền của nhóm đó.',
      };
    }

    const groups = new Map<string, number>();

    for (const record of records) {
      const title = display(query.groupBy, record[query.groupBy] ?? null);

      groups.set(title, (groups.get(title) ?? 0) + 1);
    }

    const entries = [...groups].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'),
    );

    return {
      ...reply,
      message: `Thống kê ${records.length} bản ghi theo ${labels[query.groupBy]}.`,
      hasMore: entries.length > query.offset + query.limit,
      rows: entries
        .slice(query.offset, query.offset + query.limit)
        .map(([title, count]) => ({
          title,
          fields: [{ label: 'Số bản ghi', value: String(count) }],
        })),
    };
  }

  if (query.operation === 'export') {
    const keys = Object.keys(records[0]).filter(
      (key) => key !== 'id' && key !== 'imageUrl',
    );
    const csv = [
      keys.map((key) => csvCell(labels[key] ?? key)).join(','),
      ...records.map((record) =>
        keys.map((key) => csvCell(display(key, record[key] ?? null))).join(','),
      ),
    ].join('\r\n');

    return {
      ...reply,
      message: `Báo cáo CSV gồm ${records.length} bản ghi. Bạn có thể sao chép để lưu thành tệp CSV.`,
      csv,
    };
  }

  return {
    ...reply,
    message: `Tìm thấy ${records.length} bản ghi. Hiển thị từ ${Math.min(query.offset + 1, records.length)} đến ${Math.min(query.offset + query.limit, records.length)}.`,
    hasMore: records.length > query.offset + query.limit,
    rows: records
      .slice(query.offset, query.offset + query.limit)
      .map((record) => ({
        ...row(record),
        ...(['assets', 'warehouse'].includes(query.domain)
          ? { kind: 'asset' as const }
          : {}),
      })),
  };
}

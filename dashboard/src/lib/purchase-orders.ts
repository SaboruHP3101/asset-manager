import { fetcher } from "@/lib/fetcher";

export const managementOwnerLabels = {
  it: "IT",
  procurement: "Thu mua",
};

export type ManagementOwner = keyof typeof managementOwnerLabels;

export const orderStatusLabels = {
  issued: "Đã phát hành",
  partially_received: "Đã nhận một phần",
  fully_received: "Đã nhận đủ",
  closed_short: "Đóng thiếu",
  cancelled: "Đã hủy",
};

export type ItPurchaseOrder = {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  department: string;
  status: keyof typeof orderStatusLabels;
  orderDate: string;
  expectedDeliveryDate: string;
  total: `${number}`;
};

type ItPurchaseOrderDetail = ItPurchaseOrder & {
  lines: {
    id: string;
    name: string;
    ordered: number;
    received: number;
    accepted: number;
    rejected: number;
    total: `${number}`;
    assetCodes: string[];
  }[];
};

async function request<T>(
  path: string,
  owner: ManagementOwner,
  signal: AbortSignal
): Promise<T> {
  const response = await fetcher(`/it-purchase-orders${path}?owner=${owner}`, {
    signal,
  });

  if (response.status === 401) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (response.status === 403) {
    throw new Error("Chỉ IT và Thu mua được xem đơn mua tài sản.");
  }
  if (response.status === 404 || response.status === 400) {
    throw new Error("Không tìm thấy đơn mua cho đơn vị quản lý đã chọn.");
  }
  if (!response.ok) {
    throw new Error("Không thể tải đơn mua. Vui lòng thử lại.");
  }

  return (await response.json()) as T;
}

export function getItPurchaseOrders(
  owner: ManagementOwner,
  signal: AbortSignal
) {
  return request<ItPurchaseOrder[]>("", owner, signal);
}

export function getItPurchaseOrder(
  id: string,
  owner: ManagementOwner,
  signal: AbortSignal
) {
  return request<ItPurchaseOrderDetail>(
    `/${encodeURIComponent(id)}`,
    owner,
    signal
  );
}

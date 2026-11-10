import { fetcher } from "@/lib/fetcher";

export type MonthlyRepairRequest = {
  id: string;
  closedAt: string;
  issue: string;
  cost: `${number}` | null;
};

export type RepairCostAsset = {
  id: string;
  code: string;
  name: string;
  holder: string | null;
  location: string | null;
  cost: `${number}` | null;
  requests: MonthlyRepairRequest[];
};

type MonthlyRepairCosts = {
  total: `${number}` | null;
  assets: RepairCostAsset[];
};

type RepairAttempt = {
  id: string;
  date: string;
  cost: `${number}` | null;
  technician: string;
  outcome: "accepted" | "pending" | "returned" | "recorded";
};

async function request<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetcher(`/repair-requests/costs${path}`, { signal });

  if (response.status === 401) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  if (response.status === 403) {
    throw new Error("Chỉ phòng IT được xem chi phí sửa chữa.");
  }

  if (!response.ok) {
    throw new Error("Không thể tải chi phí sửa chữa. Vui lòng thử lại.");
  }

  return (await response.json()) as T;
}

export function getRepairCosts(month: string, signal: AbortSignal) {
  return request<MonthlyRepairCosts>(
    `?month=${encodeURIComponent(month)}`,
    signal
  );
}

export function getRepairHistory(assetId: string, signal: AbortSignal) {
  return request<RepairAttempt[]>(`/${assetId}/history`, signal);
}

export async function updateRepairCost(
  request: MonthlyRepairRequest,
  cost: string,
  reason: string
) {
  const response = await fetcher(`/repair-requests/costs/${request.id}`, {
    method: "PATCH",
    body: JSON.stringify({ previousCost: request.cost, cost, reason }),
  });

  if (response.status === 401) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  if (response.status === 404 || response.status === 409) {
    throw new Error(
      "Dữ liệu phiếu đã thay đổi. Hãy đóng hộp thoại và mở lại.",
      {
        cause: response.status,
      }
    );
  }

  if (!response.ok) {
    throw new Error("Không thể lưu chi phí sửa chữa. Vui lòng thử lại.");
  }
}

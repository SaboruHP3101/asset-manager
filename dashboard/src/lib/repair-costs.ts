import { fetcher } from "@/lib/fetcher";

export type RepairCostAsset = {
  id: string;
  code: string;
  name: string;
  holder: string | null;
  location: string | null;
  cost: `${number}` | null;
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

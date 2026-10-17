import { fetcher } from "@/lib/fetcher";
import type { Asset, AssetFormValue } from "@/types";

export async function getAssets(signal?: AbortSignal): Promise<Asset[]> {
  return request<Asset[]>("/assets", { signal });
}

async function request<TData>(
  path: string,
  options: RequestInit = {}
): Promise<TData> {
  const response = await fetcher(path, options);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại."
      );
    }
    if (response.status === 403) {
      throw new Error("Chỉ nhân viên phòng IT được quản lý tài sản.");
    }
    if (response.status === 409)
      throw new Error(
        "Mã tài sản đã tồn tại hoặc danh mục/nhà cung cấp không hợp lệ. Vui lòng kiểm tra lại."
      );
    if (response.status === 404)
      throw new Error("Tài sản không còn tồn tại. Vui lòng tải lại danh sách.");
    if (response.status === 400)
      throw new Error(
        "Thông tin tài sản không hợp lệ. Vui lòng kiểm tra các trường và thử lại."
      );
    throw new Error("Không thể xử lý yêu cầu tài sản. Vui lòng thử lại.");
  }

  let data: TData;

  try {
    data = (await response.json()) as TData;
  } catch {
    throw new Error("Dữ liệu tài sản không hợp lệ. Vui lòng thử lại.");
  }

  return data;
}

export async function updateAsset(id: string, values: AssetFormValue) {
  return request<AssetFormValue & { id: string }>(`/assets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export async function getAssetOptions(signal: AbortSignal) {
  const [categories, suppliers] = await Promise.all([
    request<{ id: string; name: string }[]>("/asset-categories", { signal }),
    request<{ id: string; legalName: string }[]>("/suppliers", { signal }),
  ]);

  return {
    categories: categories.map((item) => ({ id: item.id, label: item.name })),
    suppliers: suppliers.map((item) => ({
      id: item.id,
      label: item.legalName,
    })),
  };
}

export const assetStatusLabels: Record<string, string> = {
  active: "Đang sử dụng",
  in_use: "Đang sử dụng",
  using: "Đang sử dụng",
  repairing: "Đang sửa chữa",
  fixing: "Đang sửa chữa",
  upgrading: "Đang nâng cấp",
  available: "Sẵn sàng",
  reserved_for_exchange: "Đã giữ chỗ",
  awaiting_disposal: "Chờ xử lý báo phế",
  disposed: "Đã báo phế",
  awaiting_allocation: "Chờ cấp phát",
  awaiting_reallocation: "Chờ phân bổ lại",
  awaiting_allocation_confirmation: "Chờ xác nhận",
  damaged: "Hỏng",
  broken: "Hỏng",
  inactive: "Ngừng hoạt động",
};

export const assetDepartmentLabels: Record<string, string> = {
  IT: "Phòng Công nghệ thông tin",
  ACCOUNTING: "Phòng Kế toán",
  WAREHOUSE: "Phòng Kho vận",
  PROCUREMENT: "Phòng Thu mua",
  EXECUTIVE: "Ban Điều hành",
};

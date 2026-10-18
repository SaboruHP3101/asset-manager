import { fetcher } from "@/lib/fetcher";

export type AssetCategory = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentCategoryId: string | null;
  managementOwner: "it" | "procurement";
  trackingMode: "individual_asset" | "consumable";
};

export type CategoryFormValue = Pick<
  AssetCategory,
  "code" | "name" | "managementOwner" | "trackingMode"
> & { description: string };

export const managementOwners = [
  { value: "it", label: "IT" },
  { value: "procurement", label: "Thu mua" },
];

export const trackingModes = [
  { value: "individual_asset", label: "Theo dõi từng tài sản" },
  { value: "consumable", label: "Vật tư tiêu hao" },
];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetcher(path, options);

  if (!response.ok) {
    if (response.status === 401)
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    if (response.status === 403)
      throw new Error("Chỉ phòng IT được quản lý danh mục tài sản.");

    const error = (await response.json()) as { message?: string | string[] };

    throw new Error(
      typeof error.message === "string"
        ? error.message
        : "Thông tin danh mục không hợp lệ. Vui lòng kiểm tra và thử lại."
    );
  }

  return (await response.json()) as T;
}

export function getAssetCategories(signal?: AbortSignal) {
  return request<AssetCategory[]>("/asset-categories", { signal });
}

export function saveAssetCategory(values: CategoryFormValue, id?: string) {
  const { code, name, description, managementOwner, trackingMode } = values;

  return request<AssetCategory>(
    id ? `/asset-categories/${id}` : "/asset-categories",
    {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(
        id
          ? { code, name, description }
          : { code, name, description, managementOwner, trackingMode }
      ),
    }
  );
}

export function deleteAssetCategory(id: string, force = false) {
  return request<{ deleted: boolean }>(
    `/asset-categories/${id}${force ? "?force=true" : ""}`,
    {
      method: "DELETE",
    }
  );
}

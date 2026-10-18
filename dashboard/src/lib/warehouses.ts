import { fetcher } from "@/lib/fetcher";
import type { Asset } from "@/types";

type WarehouseAsset = Pick<
  Asset,
  "id" | "assetCode" | "name" | "category" | "status"
>;

export async function getItWarehouseAssets(
  signal?: AbortSignal
): Promise<WarehouseAsset[]> {
  const response = await fetcher("/warehouses/it/assets", { signal });

  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại."
      );
    if (response.status === 403)
      throw new Error(
        "Bạn không có quyền xem kho IT. Vui lòng liên hệ phòng IT."
      );
    if (response.status === 404)
      throw new Error(
        "Không tìm thấy kho IT hoặc bạn không có quyền truy cập. Vui lòng liên hệ phòng IT."
      );

    throw new Error("Không thể tải tài sản trong kho IT. Vui lòng thử lại.");
  }

  try {
    return (await response.json()) as WarehouseAsset[];
  } catch {
    throw new Error("Dữ liệu kho IT không hợp lệ. Vui lòng thử lại.");
  }
}

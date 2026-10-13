import { getToken } from "@/lib/token-storage";

const backendUrl = import.meta.env.VITE_BACKEND_URL.replace(/\/$/, "");

export async function fetcher(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  if (!headers.has("Authorization")) {
    const token = getToken();

    if (!token) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    headers.set("Authorization", `Bearer ${token}`);
  }

  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${backendUrl}${path}`, { ...options, headers });
  } catch (error) {
    if (options.signal?.aborted) throw error;

    throw new Error("Không thể kết nối máy chủ. Vui lòng thử lại.", {
      cause: error,
    });
  }
}

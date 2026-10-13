import { fetcher } from "@/lib/fetcher";

export type Credentials = { email: string; password: string };

export type Profile = {
  fullName: string;
  email: string;
  department: string;
  isDepartmentHead: boolean;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

const backendUrl = import.meta.env.VITE_BACKEND_URL.replace(/\/$/, "");

async function request<TData = unknown>(path: string, options: RequestInit) {
  let response: Response;

  try {
    response = await (path === "me"
      ? fetcher("/auth/me", options)
      : fetch(`${backendUrl}/auth/${path}`, options));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new AuthError(
      path === "me" && error instanceof Error
        ? error.message
        : "Không thể kết nối máy chủ. Vui lòng thử lại."
    );
  }

  if (!response.ok) {
    throw new AuthError(
      response.status === 401 || response.status === 404
        ? "Email hoặc mật khẩu không đúng, hoặc tài khoản không còn hoạt động."
        : "Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại.",
      response.status
    );
  }

  try {
    return (await response.json()) as TData;
  } catch {
    throw new AuthError("Phản hồi máy chủ không hợp lệ. Vui lòng thử lại.");
  }
}

function validateProfile(data: Profile) {
  if (!data) {
    throw new AuthError("Thông tin tài khoản không hợp lệ. Vui lòng thử lại.");
  }

  if (data.department !== "IT") {
    throw new AuthError("Dashboard chỉ dành cho nhân viên phòng IT.", 403);
  }

  return data;
}

export async function getProfile(signal?: AbortSignal) {
  return validateProfile(await request<Profile>("me", { signal }));
}

export async function login(credentials: Credentials) {
  const data = await request<{ accessToken: string }>("login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!data) {
    throw new AuthError(
      "Tài khoản chưa được kích hoạt. Hãy đặt mật khẩu lần đầu trên ứng dụng di động, rồi quay lại đăng nhập."
    );
  }

  if (!data || !data.accessToken) {
    throw new AuthError("Phản hồi đăng nhập không hợp lệ. Vui lòng thử lại.");
  }

  const profile = validateProfile(
    await request<Profile>("me", {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    })
  );

  return { token: data.accessToken, profile };
}

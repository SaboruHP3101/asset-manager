import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
      <Link to="/" className="text-sm underline underline-offset-4">
        Về tổng quan
      </Link>
    </div>
  );
}

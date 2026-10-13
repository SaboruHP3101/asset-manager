import { useLocation } from "react-router";
import { resourcePages } from "@/components/main-layout";
import { Card, CardContent } from "@/components/ui/card";

export default function ResourcesPage() {
  const { pathname } = useLocation();
  const page = resourcePages.find((item) => item.path === pathname);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{page?.title}</h1>
        <p className="mt-2 text-muted-foreground">{page?.description}</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-medium">Khu vực quản lý đang được chuẩn bị</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Chức năng quản lý {page?.title} sẽ được bổ sung ở bước tiếp theo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

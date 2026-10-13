import { useAuth } from "@/components/auth-provider";
import { resourcePages } from "@/components/main-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";

export default function OverviewPage() {
  const { profile } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Tổng quan</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Xin chào, {profile?.fullName}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Chọn một khu vực để quản lý tài nguyên công ty.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {resourcePages.map((page) => (
          <Link
            key={page.path}
            to={page.path}
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-lg bg-primary/20 p-3">
                    <page.icon className="size-5" />
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </div>
                <CardTitle>{page.title}</CardTitle>
                <CardDescription>{page.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

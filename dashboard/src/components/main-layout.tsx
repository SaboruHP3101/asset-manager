import { NavLink, Outlet, useLocation } from "react-router";
import {
  Users,
  Package,
  Tags,
  Warehouse,
  ReceiptText,
  ClipboardList,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useEffect } from "react";

export const resourcePages = [
  {
    path: "/purchase-orders",
    title: "Đơn mua tài sản",
    shared: true,
    icon: ClipboardList,
  },
  {
    path: "/asset-categories",
    title: "Danh mục tài sản",
    icon: Tags,
  },
  {
    path: "/warehouse",
    title: "Kho IT",
    icon: Warehouse,
  },
  {
    path: "/repair-costs",
    title: "Chi phí sửa chữa",
    icon: ReceiptText,
  },
  {
    path: "/employees",
    title: "Nhân viên",
    icon: Users,
  },
  {
    path: "/assets",
    title: "Tài sản",
    icon: Package,
  },
];

export function canAccessResource(
  page: (typeof resourcePages)[number],
  department?: string
) {
  return (
    department === "IT" ||
    (department === "PROCUREMENT" && page.shared === true)
  );
}

function ResourceSidebar() {
  const { profile, logout } = useAuth();
  const { setTheme } = useTheme();
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const visiblePages = resourcePages.filter((page) =>
    canAccessResource(page, profile?.department)
  );
  const groups = [
    {
      label: "Mua sắm",
      pages: visiblePages.filter((page) => page.shared === true),
    },
    {
      label: "Quản lý IT",
      pages: visiblePages.filter((page) => page.shared !== true),
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b">
        <div className="flex items-center gap-3 overflow-hidden px-1">
          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="size-4.5" />
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">Quản lý tài sản</p>
            <p className="text-xs text-muted-foreground">Quản lý tài nguyên</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups
          .filter((group) => group.pages.length > 0)
          .map(({ label, pages }) => (
            <SidebarGroup key={label}>
              <SidebarGroupLabel>{label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <nav aria-label={label}>
                  <SidebarMenu>
                    {pages.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          render={<NavLink to={item.path} end />}
                          isActive={pathname === item.path}
                          tooltip={item.title}
                          onClick={() => setOpenMobile(false)}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile?.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.isDepartmentHead ? "Trưởng phòng" : "Nhân viên"}
              {" · "}
              {profile?.department === "PROCUREMENT" ? "Thu mua" : "IT"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              setTheme(
                document.documentElement.classList.contains("dark")
                  ? "light"
                  : "dark"
              )
            }
          >
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Đăng xuất">
              <LogOut />
              <span>Đăng xuất</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function MainLayout() {
  const { pathname } = useLocation();
  const title =
    resourcePages.find((item) => item.path === pathname)?.title ??
    "Không tìm thấy trang";

  useEffect(() => {
    document.title = `${title} | Admin Dashboard`;
  }, [title]);

  return (
    <SidebarProvider>
      <ResourceSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
          <SidebarTrigger aria-label="Mở hoặc thu gọn thanh điều hướng" />
          <span className="text-sm font-medium">{title}</span>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 p-5 sm:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

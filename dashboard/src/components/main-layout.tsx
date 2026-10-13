import { NavLink, Outlet, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  Tags,
  Warehouse,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
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
    path: "/employees",
    title: "Nhân viên",
    description: "Thông tin nhân viên.",
    icon: Users,
  },
  {
    path: "/assets",
    title: "Tài sản",
    description: "Chi tiết tài sản, tình trạng và nơi quản lý.",
    icon: Package,
  },
  {
    path: "/asset-categories",
    title: "Danh mục tài sản",
    description: "Phân nhóm và phân loại tài sản.",
    icon: Tags,
  },
  {
    path: "/warehouse",
    title: "Kho IT",
    description: "Tài sản đang được lưu giữ tại kho IT.",
    icon: Warehouse,
  },
];

const navigation = [
  { path: "/", title: "Tổng quan", icon: LayoutDashboard },
  ...resourcePages,
];

function ResourceSidebar() {
  const { profile, logout } = useAuth();
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b">
        <div className="flex items-center gap-3 overflow-hidden px-1">
          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="size-4.5" />
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">
              IT Resource Manager
            </p>
            <p className="text-xs text-muted-foreground">Quản lý tài nguyên</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tài nguyên</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav>
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      render={
                        <NavLink to={item.path} end aria-label={item.title} />
                      }
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
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-medium">{profile?.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {profile?.isDepartmentHead ? "Trưởng phòng IT" : "Nhân viên IT"}
          </p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              tooltip="Đăng xuất"
              aria-label="Đăng xuất"
            >
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
    navigation.find((item) => item.path === pathname)?.title ??
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

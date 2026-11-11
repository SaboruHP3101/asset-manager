import { Navigate, Route, Routes } from "react-router";
import type { ReactNode } from "react";
import { RequireAuth, useAuth } from "@/components/auth-provider";
import {
  canAccessResource,
  MainLayout,
  resourcePages,
} from "@/components/main-layout";
import LoginPage from "@/pages/login";
import NotFoundPage from "@/pages/not-found";
import EmployeesPage from "@/pages/employees";
import AssetsPage from "@/pages/assets";
import AssetCategoriesPage from "@/pages/asset-categories";
import WarehousePage from "@/pages/warehouse";
import RepairCostsPage from "@/pages/repair-costs";
import ItPurchaseOrdersPage from "@/pages/purchase-orders";

const resourceElements: Record<string, ReactNode> = {
  "/employees": <EmployeesPage />,
  "/assets": <AssetsPage />,
  "/asset-categories": <AssetCategoriesPage />,
  "/warehouse": <WarehousePage />,
  "/repair-costs": <RepairCostsPage />,
  "/purchase-orders": <ItPurchaseOrdersPage />,
};

function App() {
  const { profile } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/purchase-orders" replace />} />
          {resourcePages.map((page) => (
            <Route
              key={page.path}
              path={page.path}
              element={
                canAccessResource(page, profile?.department) ? (
                  resourceElements[page.path]
                ) : (
                  <Navigate to="/purchase-orders" replace />
                )
              }
            />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;

import { Route, Routes } from "react-router";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth-provider";
import { MainLayout, resourcePages } from "@/components/main-layout";
import LoginPage from "@/pages/login";
import OverviewPage from "@/pages/overview";
import ResourcesPage from "@/pages/resources";
import NotFoundPage from "@/pages/not-found";
import EmployeesPage from "@/pages/employees";
import AssetsPage from "@/pages/assets";
import AssetCategoriesPage from "@/pages/asset-categories";

const resourceElements: Record<string, ReactNode> = {
  "/employees": <EmployeesPage />,
  "/assets": <AssetsPage />,
  "/asset-categories": <AssetCategoriesPage />,
};

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route index element={<OverviewPage />} />
          {resourcePages.map((page) => (
            <Route
              key={page.path}
              path={page.path}
              element={resourceElements[page.path] ?? <ResourcesPage />}
            />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;

import { Route, Routes } from "react-router";
import { RequireAuth } from "@/components/auth-provider";
import { MainLayout, resourcePages } from "@/components/main-layout";
import LoginPage from "@/pages/login";
import OverviewPage from "@/pages/overview";
import ResourcesPage from "@/pages/resources";
import NotFoundPage from "@/pages/not-found";
import EmployeesPage from "@/pages/employees";

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
              element={
                page.path === "/employees" ? (
                  <EmployeesPage />
                ) : (
                  <ResourcesPage />
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

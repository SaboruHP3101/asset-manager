import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router";
import { AuthError, getProfile, type Profile } from "@/lib/auth";
import {
  getToken,
  setToken as storeToken,
  removeToken,
  TOKEN_KEY,
} from "@/lib/token-storage";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Session = { token: string; profile: Profile };

type AuthCtx = {
  token: string | null;
  profile: Profile | undefined;
  startSession: (session: Session) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(getToken);
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", token],
    queryFn: ({ signal }) => getProfile(signal),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    function syncToken(event: StorageEvent) {
      if (
        event.storageArea !== localStorage ||
        (event.key !== TOKEN_KEY && event.key !== null)
      )
        return;

      queryClient.cancelQueries();
      queryClient.clear();

      setToken(getToken());
    }

    window.addEventListener("storage", syncToken);

    return () => window.removeEventListener("storage", syncToken);
  }, [queryClient]);

  function startSession(session: Session) {
    storeToken(session.token);
    queryClient.setQueryData(["profile", session.token], session.profile);
    setToken(session.token);
  }

  function logout() {
    removeToken();
    setToken(null);
    queryClient.cancelQueries();
    queryClient.clear();
  }

  const value: AuthCtx = {
    token,
    profile: profile.data,
    startSession,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {token && profile.isPending ? (
        <div className="grid min-h-svh place-items-center" role="status">
          Đang tải…
        </div>
      ) : token && profile.isError ? (
        <div className="grid min-h-svh place-items-center p-6">
          <Alert className="max-w-md">
            <AlertTitle>Không thể mở dashboard</AlertTitle>
            <AlertDescription>
              <p>
                {profile.error instanceof AuthError &&
                profile.error.status === 401
                  ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
                  : profile.error.message}
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => profile.refetch()}
                  disabled={profile.isFetching}
                >
                  Thử lại
                </Button>
                <Button onClick={logout}>Đăng xuất</Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}

export function RequireAuth() {
  const { token } = useAuth();
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { ArrowRight, LoaderCircle, Package } from "lucide-react";
import { login, type Credentials } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const { token, startSession } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Credentials>({ defaultValues: { email: "", password: "" } });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess(session) {
      startSession(session);
      navigate("/", { replace: true });
    },
  });

  function onSubmit(data: Credentials) {
    mutation.mutate(data);
  }

  if (token) return <Navigate to="/" replace />;

  return (
    <main className="grid min-h-svh lg:grid-cols-[60%_40%]">
      <section className="hidden flex-col justify-between lg:flex">
        <img className="size-full object-cover" src="/login-img.jpg" />
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 font-semibold lg:hidden">
            <Package className="size-5" />
            IT Resource Manager
          </div>
          <Card className="border-0 p-4 shadow-none">
            <CardHeader className="px-0">
              <CardTitle className="text-2xl">Chào mừng trở lại</CardTitle>
              <CardDescription>
                Đăng nhập bằng tài khoản công ty để quản lý tài nguyên.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <form
                noValidate
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
                aria-busy={mutation.isPending}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email công ty</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="it@company.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email", {
                      required: "Vui lòng nhập email.",
                      maxLength: {
                        value: 100,
                        message: "Email tối đa 100 ký tự.",
                      },
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Vui lòng nhập email hợp lệ.",
                      },
                    })}
                  />
                  {errors.email ? (
                    <p
                      id="email-error"
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {errors.email.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    {...register("password", {
                      required: "Vui lòng nhập mật khẩu.",
                      maxLength: {
                        value: 100,
                        message: "Mật khẩu tối đa 100 ký tự.",
                      },
                    })}
                  />
                  {errors.password ? (
                    <p
                      id="password-error"
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>
                {mutation.isError ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {mutation.error.message}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      Đang đăng nhập…
                    </>
                  ) : (
                    <>
                      Đăng nhập
                      <ArrowRight />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

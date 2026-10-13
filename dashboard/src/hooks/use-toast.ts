import toast from "react-hot-toast";

const toastFunctions = {
  toast,
  success: toast.success,
  error: toast.error,
  loading: toast.loading,
  promise: toast.promise,
  dismiss: toast.dismiss,
};

export function useToast() {
  return toastFunctions;
}

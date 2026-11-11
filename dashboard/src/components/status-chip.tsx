import {
  Archive,
  ArrowUp,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  CircleX,
  Clock,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusTones: Record<string, string> = {
  active: "success",
  in_use: "success",
  using: "success",
  available: "success",
  repairing: "warning",
  fixing: "warning",
  upgrading: "warning",
  reserved_for_exchange: "warning",
  awaiting_disposal: "warning",
  awaiting_allocation: "warning",
  awaiting_reallocation: "warning",
  awaiting_allocation_confirmation: "warning",
  damaged: "danger",
  broken: "danger",
};

const toneClasses: Record<string, string> = {
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive",
};

const statusIcons: Record<string, LucideIcon> = {
  active: CircleCheck,
  in_use: CircleCheck,
  using: CircleCheck,
  available: CircleCheck,
  repairing: Wrench,
  fixing: Wrench,
  upgrading: ArrowUp,
  reserved_for_exchange: Clock,
  awaiting_disposal: Clock,
  awaiting_allocation: Clock,
  awaiting_reallocation: Clock,
  awaiting_allocation_confirmation: Clock,
  damaged: CircleX,
  broken: CircleX,
  disposed: Archive,
  inactive: CircleMinus,
};

export default function StatusChip({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const value = status.toLowerCase();
  const Icon = statusIcons[value] ?? CircleHelp;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[statusTones[value]] ?? "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type BadgeTone = "default" | "success" | "warning" | "muted" | "info";

const toneStyles: Record<BadgeTone, string> = {
  default: "border-white/10 bg-white/8 text-white",
  success: "border-emerald-400/20 bg-emerald-400/15 text-emerald-200",
  warning: "border-amber-400/20 bg-amber-400/15 text-amber-100",
  muted: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  info: "border-cyan-400/20 bg-cyan-400/15 text-cyan-100",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}

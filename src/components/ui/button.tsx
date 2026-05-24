import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-300 focus-visible:ring-cyan-300",
  secondary:
    "bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-400 focus-visible:ring-violet-300",
  outline:
    "border border-white/15 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-white/20",
  ghost: "bg-transparent text-slate-200 hover:bg-white/8 focus-visible:ring-white/20",
  destructive:
    "bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-400 focus-visible:ring-rose-300",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = "default",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}

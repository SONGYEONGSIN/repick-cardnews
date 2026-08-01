import type { ButtonHTMLAttributes } from "react";
import { FOCUS_RING } from "./focus";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[transform,background-color,border-color] duration-200 " +
  `${FOCUS_RING} disabled:opacity-45 disabled:cursor-not-allowed motion-reduce:transition-none`;

const VARIANTS = {
  primary: "bg-plum text-white hover:bg-plum-hover active:bg-plum-active border border-transparent",
  secondary: "bg-surface text-ink border border-hair hover:border-ink-3",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:text-ink hover:bg-hair-soft",
} as const;

const SIZES = {
  md: "h-11 px-4 text-[15px]",
  sm: "h-9 px-3 text-sm",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest} />;
}

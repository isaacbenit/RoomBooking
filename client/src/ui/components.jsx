import React from "react";

export function Card({ children, className = "" }) {
  return (
    <div
      className={["rounded-lg border border-gray-200 bg-white shadow-sm", className].join(" ")}
    >
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", size = "md", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";
  const sizes = {
    md: "rounded-md px-4 py-2 text-sm",
    sm: "rounded-md px-3 py-1.5 text-xs",
  };
  const variants = {
    primary:  "bg-[#2D6A4F] text-white hover:bg-[#1B4332]",
    subtle:   "bg-gray-100 text-gray-800 hover:bg-gray-200",
    danger:   "bg-red-600 text-white hover:bg-red-700",
    outline:  "border border-[#2D6A4F] text-[#2D6A4F] bg-white hover:bg-[#D1FAE5]",
  };
  return (
    <button className={[base, sizes[size], variants[variant], className].join(" ")} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, error, ...props }) {
  return (
    <label className="block">
      {label ? (
        <div className="mb-1 text-xs font-medium tracking-wide text-gray-600" style={{ letterSpacing: "0.02em" }}>
          {label}
        </div>
      ) : null}
      <input
        className={[
          "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition",
          "focus:ring-2 focus:ring-[#74C69D] focus:border-[#2D6A4F]",
          error ? "border-red-400" : "border-gray-300",
        ].join(" ")}
        {...props}
      />
      {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
    </label>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <label className="block">
      {label ? (
        <div className="mb-1 text-xs font-medium tracking-wide text-gray-600" style={{ letterSpacing: "0.02em" }}>
          {label}
        </div>
      ) : null}
      <select
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-[#74C69D] focus:border-[#2D6A4F]"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Badge({ children, tone = "green" }) {
  const tones = {
    green:  "bg-[#D1FAE5] text-[#1B4332] border-[#74C69D]",
    teal:   "bg-[#B7E4E2] text-[#0F4C45] border-[#4ECDC4]",
    slate:  "bg-gray-100 text-gray-700 border-gray-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    blue:   "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone] ?? tones.green,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold text-gray-900 break-words" style={{ fontSize: "1rem" }}>
          {title}
        </div>
        {subtitle ? <div className="mt-0.5 text-sm text-gray-500 break-words">{subtitle}</div> : null}
      </div>
      {right ? (
        <div className="w-full shrink-0 sm:w-auto sm:max-w-[min(100%,22rem)] flex sm:justify-end">{right}</div>
      ) : null}
    </div>
  );
}

export function Alert({ children, variant = "error" }) {
  const variants = {
    error:   "border-red-200 bg-red-50 text-red-700",
    success: "border-[#74C69D] bg-[#D1FAE5] text-[#1B4332]",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info:    "border-[#4ECDC4] bg-[#B7E4E2] text-[#0F4C45]",
  };
  return (
    <div className={["rounded-md border px-3 py-2 text-sm", variants[variant]].join(" ")}>
      {children}
    </div>
  );
}

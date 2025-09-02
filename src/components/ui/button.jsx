import React from "react";

const variants = {
  default: "btn",
  secondary: "btn secondary",
  outline: "btn outline",
  destructive: "btn destructive",
};

const sizes = {
  default: "text-sm",
  sm: "text-sm py-2 px-3",
  lg: "text-base py-3 px-5",
};

export function Button({ children, variant = "default", size = "default", className="", ...props }) {
  const cls = `${variants[variant] ?? variants.default} ${sizes[size] ?? ""} ${className}`;
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

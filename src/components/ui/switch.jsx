import React from "react";

export function Switch({ checked = false, onCheckedChange = () => {}, className = "" }) {
  return (
    <label className={`relative inline-flex items-center cursor-pointer ${className}`}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-slate-600 transition-colors"></div>
      <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`}></div>
    </label>
  );
}

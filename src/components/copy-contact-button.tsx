"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";

type CopyContactButtonProps = {
  name: string;
  phone: string;
  className?: string;
};

export function CopyContactButton({ name, phone, className = "" }: CopyContactButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const text = `${name}\n${phone}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`group flex items-center justify-center transition-colors ${className}`}
      aria-label="Copy name & phone"
      title="Copy name & phone"
    >
      {copied ? (
        <Check size={14} className="text-emerald-500" />
      ) : (
        <Copy size={14} className="text-slate-400 group-hover:text-slate-700" />
      )}
    </button>
  );
}

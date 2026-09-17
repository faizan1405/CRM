"use client";

import { useWhatsApp, type WhatsAppConfig } from "./whatsapp-context";
import React from "react";

interface WhatsAppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lead: any;
  config?: WhatsAppConfig;
}

export function WhatsAppButton({ lead, config, children, onClick, ...props }: WhatsAppButtonProps) {
  const { openWhatsApp } = useWhatsApp();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    openWhatsApp(lead, config);
    if (onClick) onClick(e);
  };

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

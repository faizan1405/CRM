"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { WhatsAppTemplatePicker } from "@/components/whatsapp-template-picker";

type WhatsAppContextType = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openWhatsApp: (lead: any) => void;
};

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentLead, setCurrentLead] = useState<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openWhatsApp = (lead: any) => {
    setCurrentLead(lead);
    setIsOpen(true);
  };

  return (
    <WhatsAppContext.Provider value={{ openWhatsApp }}>
      {children}
      {currentLead && (
        <WhatsAppTemplatePicker
          isOpen={isOpen}
          lead={currentLead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </WhatsAppContext.Provider>
  );
}

export function useWhatsApp() {
  const context = useContext(WhatsAppContext);
  if (!context) throw new Error("useWhatsApp must be used within WhatsAppProvider");
  return context;
}

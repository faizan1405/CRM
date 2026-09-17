"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { WhatsAppTemplatePicker } from "@/components/whatsapp-template-picker";
import { WhatsAppLeadSelector } from "@/components/whatsapp-lead-selector";

export type WhatsAppConfig = {
  templateTitle?: string;
  packageId?: string;
  sampleId?: string;
  category?: string;
};

type WhatsAppContextType = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openWhatsApp: (lead: any, config?: WhatsAppConfig) => void;
  openWhatsAppForAsset: (config: WhatsAppConfig) => void;
};

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentLead, setCurrentLead] = useState<any>(null);
  const [currentConfig, setCurrentConfig] = useState<WhatsAppConfig | undefined>(undefined);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<WhatsAppConfig | undefined>(undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openWhatsApp = useCallback((lead: any, config?: WhatsAppConfig) => {
    setCurrentLead(lead);
    setCurrentConfig(config);
    setIsOpen(true);
  }, []);

  const openWhatsAppForAsset = useCallback((config: WhatsAppConfig) => {
    setPendingConfig(config);
    setSelectorOpen(true);
  }, []);

  return (
    <WhatsAppContext.Provider value={{ openWhatsApp, openWhatsAppForAsset }}>
      {children}
      {currentLead && (
        <WhatsAppTemplatePicker
          isOpen={isOpen}
          lead={currentLead}
          config={currentConfig}
          onClose={() => {
            setIsOpen(false);
            setCurrentConfig(undefined);
            setCurrentLead(null);
          }}
        />
      )}
      <WhatsAppLeadSelector
        isOpen={selectorOpen}
        onClose={() => {
          setSelectorOpen(false);
          setPendingConfig(undefined);
        }}
        onSelect={(lead) => {
          setSelectorOpen(false);
          openWhatsApp(lead, pendingConfig);
          setPendingConfig(undefined);
        }}
      />
    </WhatsAppContext.Provider>
  );
}

export function useWhatsApp() {
  const context = useContext(WhatsAppContext);
  if (!context) throw new Error("useWhatsApp must be used within WhatsAppProvider");
  return context;
}

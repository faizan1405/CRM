"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { CallOutcomeModal } from "./call-outcome-modal";

type CallContextType = {
  openCallModal: (lead: Lead) => void;
};

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({
  children,
  onFollowUpNeeded,
  onStatusChanged,
}: {
  children: ReactNode;
  onFollowUpNeeded?: (leadId: string, date: string, time: string) => void;
  onStatusChanged?: (leadId: string, newStatus: LeadStatus) => void;
}) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const openCallModal = (lead: Lead) => {
    // We open the tel link right away
    window.location.href = `tel:${lead.phone}`;
    // Then show the outcome modal
    setActiveLead(lead);
  };

  const closeCallModal = () => setActiveLead(null);

  return (
    <CallContext.Provider value={{ openCallModal }}>
      {children}
      <CallOutcomeModal
        isOpen={!!activeLead}
        lead={activeLead}
        onClose={closeCallModal}
        onStatusChanged={onStatusChanged}
        onFollowUpScheduled={(leadId, scheduledAt) => {
          if (onFollowUpNeeded) {
            const d = new Date(scheduledAt);
            const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
            const timeStr = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
            onFollowUpNeeded(leadId, dateStr, timeStr);
          }
        }}
      />
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}

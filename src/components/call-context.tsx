"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Lead } from "@/features/leads/types";
import { CallOutcomeModal } from "./call-outcome-modal";
import { createFollowUp } from "@/app/actions/follow-ups";
import { useToast } from "@/components/toast-provider";

type CallContextType = {
  openCallModal: (lead: Lead) => void;
};

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children, onFollowUpNeeded }: { children: ReactNode, onFollowUpNeeded?: (leadId: string, date: string, time: string) => void }) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const { showToast } = useToast();

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
        onFollowUpNeeded={async (date, time) => {
          if (activeLead && onFollowUpNeeded) {
            onFollowUpNeeded(activeLead.id, date, time);
          } else if (activeLead) {
            // Default handler: create a quick follow-up
            const formData = new FormData();
            formData.append("leadId", activeLead.id);
            formData.append("scheduledAt", `${date}T${time}:00+05:30`);
            formData.append("type", "Call");
            formData.append("note", "Scheduled after call");
            
            const res = await createFollowUp(formData);
            if (res.success) {
              showToast("Follow-up scheduled", "success", {
                label: "Undo",
                onClick: async () => {
                  const undoRes = await import("@/app/actions/follow-ups").then(m => m.undoCreateFollowUp(res.data.id));
                  if (undoRes.success) {
                    showToast("Follow-up creation undone", "info");
                  }
                }
              });
            } else {
              showToast(res.error || "Failed", "error");
            }
          }
          closeCallModal();
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

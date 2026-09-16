import { CalendarPlus, MessageCircle, NotebookPen, Phone, RefreshCcw, Trash2, RotateCcw } from "lucide-react";
import { getTelephoneHref, getWhatsAppHref } from "./contact-links";
import { useWhatsApp } from "@/components/whatsapp-context";
import type { Lead } from "./types";

type LeadQuickActionsProps = {
  lead: Lead;
  onAddNote?: () => void;
  onAddFollowUp?: () => void;
  onChangeStatus?: () => void;
  onOpenWhatsAppComposer?: () => void;
  whatsAppMessage?: string;
  className?: string;
  onMarkWaste?: () => void;
  onRestoreWaste?: () => void;
};

const actionClass = "group flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-center text-[10px] font-semibold leading-tight text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200 focus-visible:z-10 disabled:cursor-not-allowed disabled:opacity-40";

export function LeadQuickActions({ lead, onAddNote, onAddFollowUp, onChangeStatus, onOpenWhatsAppComposer, whatsAppMessage, className = "", onMarkWaste, onRestoreWaste }: LeadQuickActionsProps) {
  const showWasteActions = Boolean(onMarkWaste || onRestoreWaste);
  const { openWhatsApp } = useWhatsApp();
  
  return (
    <div aria-label={`Quick actions for ${lead.name}`} className={`grid ${showWasteActions ? "grid-cols-3" : "grid-cols-5"} gap-1 ${className}`}>
      <a href={getTelephoneHref(lead.phone)} className={actionClass} aria-label={`Call ${lead.name} at ${lead.phone}`}>
        <Phone aria-hidden="true" size={18} className="text-blue-600 transition-transform group-active:scale-90" />Call
      </a>
      {onOpenWhatsAppComposer ? (
        <button type="button" onClick={onOpenWhatsAppComposer} className={actionClass} aria-label={`Message ${lead.name} on WhatsApp`}>
          <MessageCircle aria-hidden="true" size={18} className="text-emerald-600 transition-transform group-active:scale-90" />WhatsApp
        </button>
      ) : (
        <button type="button" onClick={() => openWhatsApp(lead)} className={actionClass} aria-label={`Message ${lead.name} on WhatsApp`}>
          <MessageCircle aria-hidden="true" size={18} className="text-emerald-600 transition-transform group-active:scale-90" />WhatsApp
        </button>
      )}
      {showWasteActions ? (
        <>
          {onRestoreWaste ? (
            <button type="button" onClick={onRestoreWaste} className={actionClass} aria-label={`Restore ${lead.name}`}>
              <RotateCcw aria-hidden="true" size={18} className="text-emerald-600 transition-transform group-active:scale-90" />Restore
            </button>
          ) : (
            <button type="button" onClick={onMarkWaste} className={actionClass} aria-label={`Mark ${lead.name} as waste`}>
              <Trash2 aria-hidden="true" size={18} className="text-slate-500 transition-transform group-active:scale-90" />Waste
            </button>
          )}
          <button type="button" onClick={onAddNote} disabled={!onAddNote} className={actionClass} aria-label={`Add note for ${lead.name}`}>
            <NotebookPen aria-hidden="true" size={18} className="text-violet-600 transition-transform group-active:scale-90" />Add note
          </button>
          <button type="button" onClick={onChangeStatus} disabled={!onChangeStatus} className={actionClass} aria-label={`Change status for ${lead.name}`}>
            <RefreshCcw aria-hidden="true" size={18} className="text-cyan-700 transition-transform group-active:rotate-12" />Status
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onAddNote} disabled={!onAddNote} className={actionClass} aria-label={`Add note for ${lead.name}`}>
            <NotebookPen aria-hidden="true" size={18} className="text-violet-600 transition-transform group-active:scale-90" />Add note
          </button>
          <button type="button" onClick={onAddFollowUp} disabled={!onAddFollowUp} className={actionClass} aria-label={`Add follow-up for ${lead.name}`}>
            <CalendarPlus aria-hidden="true" size={18} className="text-amber-600 transition-transform group-active:scale-90" />Follow-up
          </button>
          <button type="button" onClick={onChangeStatus} disabled={!onChangeStatus} className={actionClass} aria-label={`Change status for ${lead.name}`}>
            <RefreshCcw aria-hidden="true" size={18} className="text-cyan-700 transition-transform group-active:rotate-12" />Status
          </button>
        </>
      )}
    </div>
  );
}

import { CalendarPlus, MessageCircle, NotebookPen, Phone, RefreshCcw } from "lucide-react";
import { getTelephoneHref, getWhatsAppHref } from "./contact-links";
import type { Lead } from "./types";

type LeadQuickActionsProps = {
  lead: Lead;
  onAddNote?: () => void;
  onAddFollowUp?: () => void;
  onChangeStatus?: () => void;
  onOpenWhatsAppComposer?: () => void;
  whatsAppMessage?: string;
  className?: string;
};

const actionClass = "group flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-center text-[10px] font-semibold leading-tight text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200 focus-visible:z-10 disabled:cursor-not-allowed disabled:opacity-40";

export function LeadQuickActions({ lead, onAddNote, onAddFollowUp, onChangeStatus, onOpenWhatsAppComposer, whatsAppMessage, className = "" }: LeadQuickActionsProps) {
  return (
    <div aria-label={`Quick actions for ${lead.name}`} className={`grid grid-cols-5 gap-1 ${className}`}>
      <a href={getTelephoneHref(lead.phone)} className={actionClass} aria-label={`Call ${lead.name} at ${lead.phone}`}>
        <Phone aria-hidden="true" size={18} className="text-blue-600 transition-transform group-active:scale-90" />Call
      </a>
      {onOpenWhatsAppComposer ? (
        <button type="button" onClick={onOpenWhatsAppComposer} className={actionClass} aria-label={`Message ${lead.name} on WhatsApp`}>
          <MessageCircle aria-hidden="true" size={18} className="text-emerald-600 transition-transform group-active:scale-90" />WhatsApp
        </button>
      ) : (
        <a href={getWhatsAppHref(lead.phone, lead.name, whatsAppMessage)} target="_blank" rel="noopener noreferrer" className={actionClass} aria-label={`Message ${lead.name} on WhatsApp`}>
          <MessageCircle aria-hidden="true" size={18} className="text-emerald-600 transition-transform group-active:scale-90" />WhatsApp
        </a>
      )}
      <button type="button" onClick={onAddNote} disabled={!onAddNote} className={actionClass} aria-label={`Add note for ${lead.name}`}>
        <NotebookPen aria-hidden="true" size={18} className="text-violet-600 transition-transform group-active:scale-90" />Add note
      </button>
      <button type="button" onClick={onAddFollowUp} disabled={!onAddFollowUp} className={actionClass} aria-label={`Add follow-up for ${lead.name}`}>
        <CalendarPlus aria-hidden="true" size={18} className="text-amber-600 transition-transform group-active:scale-90" />Follow-up
      </button>
      <button type="button" onClick={onChangeStatus} disabled={!onChangeStatus} className={actionClass} aria-label={`Change status for ${lead.name}`}>
        <RefreshCcw aria-hidden="true" size={18} className="text-cyan-700 transition-transform group-active:rotate-12" />Status
      </button>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { getLeadActivities, addLeadNote, updateLeadNote, deleteLeadNote } from "@/app/actions/activities";
import type { Activity, ActivityFilter } from "@/features/activity/types";
import type { LeadActivity } from "@/features/activities/types";

function mapBackendActivity(ba: LeadActivity): Activity {
  const base = {
    id: ba.id,
    type: ba.type as Activity["type"],
    createdAt: ba.createdAt,
    actor: ba.createdByUserId ? { id: ba.createdByUserId, name: "User" } : null, // Backend doesn't return user name yet
  };
  
  const meta = (ba.metadata || {}) as Record<string, unknown>;

  switch (ba.type) {
    case "NOTE_ADDED":
      return { ...base, type: "NOTE_ADDED", noteId: ba.id, noteText: ba.message };
    case "STATUS_CHANGED":
      return { ...base, type: "STATUS_CHANGED", previousStatus: String(meta.oldStatus || ""), newStatus: String(meta.newStatus || "") };
    case "FOLLOWUP_CREATED":
      return { ...base, type: "FOLLOWUP_CREATED", followUpId: ba.id, followUpType: String(meta.type || ""), scheduledDate: String(meta.scheduledAt || "") };
    case "FOLLOWUP_RESCHEDULED":
      return { ...base, type: "FOLLOWUP_RESCHEDULED", followUpId: ba.id, followUpType: String(meta.type || ""), previousDate: String(meta.scheduledAtBefore || ""), newDate: String(meta.scheduledAtAfter || "") };
    case "FOLLOWUP_COMPLETED":
      return { ...base, type: "FOLLOWUP_COMPLETED", followUpId: ba.id, followUpType: String(meta.type || "") };
    case "FOLLOWUP_CANCELLED":
      return { ...base, type: "FOLLOWUP_CANCELLED", followUpId: ba.id, followUpType: String(meta.type || "") };
    case "LEAD_CREATED":
      return { ...base, type: "LEAD_CREATED" };
    case "LEAD_UPDATED":
      return { ...base, type: "LEAD_UPDATED", changes: [] };
    default:
      // Fallback for any unknown types, mapping to LEAD_UPDATED just to satisfy type
      return { ...base, type: "LEAD_UPDATED", changes: [] };
  }
}

export function useLeadActivities(leadId: string | undefined) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!leadId) {
      setActivities([]);
      return;
    }
    const result = await getLeadActivities(leadId);
    if (result.success) {
      setActivities(result.data.map(mapBackendActivity));
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchActivities();
  }, [fetchActivities]);

  const handleAddNote = async (text: string) => {
    if (!leadId) return { success: false, error: "No lead selected" };
    const result = await addLeadNote(leadId, text);
    if (result.success) {
      await fetchActivities();
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const handleEditNote = async ({ id, noteText }: { id: string; noteId: string; noteText: string }) => {
    const result = await updateLeadNote(id, noteText);
    if (result.success) {
      await fetchActivities();
    } else {
      alert(result.error);
    }
  };

  const handleDeleteNote = async ({ id }: { id: string; noteId: string }) => {
    if (!window.confirm("Delete this note?")) return;
    const result = await deleteLeadNote(id);
    if (result.success) {
      await fetchActivities();
    } else {
      alert(result.error);
    }
  };

  return {
    activities,
    filter,
    setFilter,
    loading,
    refresh: fetchActivities,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,
  };
}

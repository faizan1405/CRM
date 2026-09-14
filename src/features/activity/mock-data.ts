import type { Activity } from "./types";

/**
 * Temporary mock activities for Phase 5 UI development.
 * Agent A should replace this with real data from Server Actions.
 */
export const mockActivities: Activity[] = [
  {
    id: "act-1",
    type: "LEAD_CREATED",
    createdAt: "2026-09-10T09:15:00Z",
    actor: { id: "u-1", name: "Priya Sharma" },
  },
  {
    id: "act-2",
    type: "STATUS_CHANGED",
    createdAt: "2026-09-10T10:30:00Z",
    actor: { id: "u-1", name: "Priya Sharma" },
    previousStatus: "New",
    newStatus: "Contacted",
  },
  {
    id: "act-3",
    type: "NOTE_ADDED",
    createdAt: "2026-09-10T14:22:00Z",
    actor: { id: "u-1", name: "Priya Sharma" },
    noteId: "note-1",
    noteText: "Called the client. They are interested in our enterprise plan. Follow up next week.",
  },
  {
    id: "act-4",
    type: "FOLLOWUP_CREATED",
    createdAt: "2026-09-11T09:00:00Z",
    actor: { id: "u-1", name: "Priya Sharma" },
    followUpId: "fu-1",
    followUpType: "Call",
    scheduledDate: "2026-09-17T09:00:00Z",
  },
  {
    id: "act-5",
    type: "STATUS_CHANGED",
    createdAt: "2026-09-14T03:42:00Z",
    actor: { id: "u-1", name: "Priya Sharma" },
    previousStatus: "Contacted",
    newStatus: "Qualified",
  },
  {
    id: "act-6",
    type: "NOTE_ADDED",
    createdAt: "2026-09-14T06:20:00Z",
    actor: { id: "u-1", name: "Priya Sharma" },
    noteId: "note-2",
    noteText: "Client wants to discuss with partner before deciding.",
  },
  {
    id: "act-7",
    type: "FOLLOWUP_COMPLETED",
    createdAt: "2026-09-14T11:10:00Z",
    actor: { id: "u-1", name: "Priya Sharma" },
    followUpId: "fu-2",
    followUpType: "WhatsApp",
  },
];

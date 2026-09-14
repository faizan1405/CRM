export type ActivityType =
  | "NOTE_ADDED"
  | "NOTE_EDITED"
  | "NOTE_DELETED"
  | "STATUS_CHANGED"
  | "FOLLOWUP_CREATED"
  | "FOLLOWUP_RESCHEDULED"
  | "FOLLOWUP_COMPLETED"
  | "FOLLOWUP_CANCELLED"
  | "LEAD_CREATED"
  | "LEAD_UPDATED";

export type ActivityActor = {
  id: string;
  name: string;
};

export type BaseActivity = {
  id: string;
  type: ActivityType;
  createdAt: string;
  actor: ActivityActor | null;
};

export type NoteAddedActivity = BaseActivity & {
  type: "NOTE_ADDED";
  noteId: string;
  noteText: string;
};

export type NoteEditedActivity = BaseActivity & {
  type: "NOTE_EDITED";
  noteId: string;
  noteText: string;
  previousText?: string;
};

export type NoteDeletedActivity = BaseActivity & {
  type: "NOTE_DELETED";
  noteId: string;
};

export type StatusChangedActivity = BaseActivity & {
  type: "STATUS_CHANGED";
  previousStatus: string;
  newStatus: string;
};

export type FollowUpCreatedActivity = BaseActivity & {
  type: "FOLLOWUP_CREATED";
  followUpId: string;
  followUpType: string;
  scheduledDate: string;
};

export type FollowUpRescheduledActivity = BaseActivity & {
  type: "FOLLOWUP_RESCHEDULED";
  followUpId: string;
  followUpType: string;
  previousDate: string;
  newDate: string;
};

export type FollowUpCompletedActivity = BaseActivity & {
  type: "FOLLOWUP_COMPLETED";
  followUpId: string;
  followUpType: string;
};

export type FollowUpCancelledActivity = BaseActivity & {
  type: "FOLLOWUP_CANCELLED";
  followUpId: string;
  followUpType: string;
};

export type LeadCreatedActivity = BaseActivity & {
  type: "LEAD_CREATED";
};

export type LeadUpdatedActivity = BaseActivity & {
  type: "LEAD_UPDATED";
  changes: string[];
};

export type Activity =
  | NoteAddedActivity
  | NoteEditedActivity
  | NoteDeletedActivity
  | StatusChangedActivity
  | FollowUpCreatedActivity
  | FollowUpRescheduledActivity
  | FollowUpCompletedActivity
  | FollowUpCancelledActivity
  | LeadCreatedActivity
  | LeadUpdatedActivity;

export type ActivityFilter = "all" | "notes" | "status" | "followups";

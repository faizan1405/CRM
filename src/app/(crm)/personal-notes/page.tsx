import type { Metadata } from "next";
import { NotesWorkspace } from "@/features/personal-notes";
import { getPersonalNotes } from "@/app/actions/personal-notes";

export const metadata: Metadata = {
  title: "Personal Notes | CRM",
  description: "Private scratchpad and personal workspace for CRM owner.",
};

export const dynamic = "force-dynamic";

export default async function PersonalNotesPage() {
  const result = await getPersonalNotes();
  const initialNotes = result.success && result.data ? result.data : [];

  return <NotesWorkspace initialNotes={initialNotes} />;
}

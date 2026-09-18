import { redirect } from "next/navigation";

export default function RecentlyDeletedPage() {
  redirect("/settings?tab=recently-deleted");
}


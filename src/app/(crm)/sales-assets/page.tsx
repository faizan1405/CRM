import { redirect } from "next/navigation";

export default function SalesAssetsPage() {
  redirect("/settings?tab=sales-assets");
}


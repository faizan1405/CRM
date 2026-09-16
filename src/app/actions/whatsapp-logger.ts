"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function logWhatsAppOpened(leadId: string, templateName: string) {
  if (!leadId) return { success: false, error: "No leadId provided" };
  try {
    await db.leadActivity.create({
      data: {
        leadId,
        type: "WHATSAPP_OPENED",
        message: "WhatsApp Opened",
        metadata: {
          action: "WHATSAPP_OPENED",
          templateName
        }
      }
    });
    revalidatePath("/leads/" + leadId);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

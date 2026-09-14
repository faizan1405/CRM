"use server";

import { getSession } from "@/lib/auth";
import { getFollowUps } from "./follow-ups";
import type { FollowUp } from "@/features/followups/types";

class UserFacingError extends Error {}

export async function getDashboardFollowUpStats(): Promise<{
  success: boolean;
  data?: {
    todayCount: number;
    overdueCount: number;
    todayList: FollowUp[];
  };
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session || typeof session.id !== "string") {
      throw new UserFacingError("You must be signed in.");
    }

    const followUpsRes = await getFollowUps();
    if (!followUpsRes.success) {
      throw new Error(followUpsRes.error);
    }

    return {
      success: true,
      data: {
        todayCount: followUpsRes.data.today.length,
        overdueCount: followUpsRes.data.overdue.length,
        todayList: followUpsRes.data.today,
      }
    };
  } catch (error) {
    if (error instanceof UserFacingError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Could not load dashboard stats." };
  }
}

/**
 * Next.js Server Instrumentation
 * Automatically starts the background due follow-up push notification scheduler
 * when the server initializes in the Node.js runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startMobileScheduler } = await import(
        "@/features/notifications/services/mobile-scheduler"
      );
      startMobileScheduler(30000); // Check every 30 seconds
    } catch (error) {
      console.error("[Instrumentation] Failed to start mobile scheduler:", error);
    }
  }
}

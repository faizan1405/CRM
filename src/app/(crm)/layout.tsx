import { AppSidebar } from "@/components/app-sidebar";
import { MobileNavigation } from "@/components/mobile-navigation";
import { MobileHeader } from "@/components/mobile-header";
import { LeadNavigationProvider } from "@/features/leads/lead-navigation-provider";
import { ToastProvider } from "@/components/toast-provider";
import { WhatsAppProvider } from "@/components/whatsapp-context";
import { CallProvider } from "@/components/call-context";
import { CrmSyncProvider } from "@/components/crm-sync-provider";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WhatsAppProvider>
        <CallProvider>
          <LeadNavigationProvider>
            <CrmSyncProvider>
              <div className="min-h-dvh max-w-full overflow-x-clip lg:flex pb-[calc(4rem+env(safe-area-inset-bottom)+1.5rem)] lg:pb-0">
                <AppSidebar />
                <div className="min-w-0 max-w-full flex-1">
                  <MobileHeader />
                  <main className="mx-auto w-full max-w-[96rem] min-w-0 px-4 py-4 sm:px-6 sm:py-8 lg:px-10 lg:py-10 xl:px-12 pb-safe">
                    {children}
                  </main>
                </div>
                <MobileNavigation />
              </div>
            </CrmSyncProvider>
          </LeadNavigationProvider>
        </CallProvider>
      </WhatsAppProvider>
    </ToastProvider>
  );
}

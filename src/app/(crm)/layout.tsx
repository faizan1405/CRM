import { AppSidebar } from "@/components/app-sidebar";
import { MobileNavigation } from "@/components/mobile-navigation";
import { MobileHeader } from "@/components/mobile-header";
import { LeadNavigationProvider } from "@/features/leads/lead-navigation-provider";
import { ToastProvider } from "@/components/toast-provider";
import { WhatsAppProvider } from "@/components/whatsapp-context";
import { CallProvider } from "@/components/call-context";
import { CrmSyncProvider } from "@/components/crm-sync-provider";
import { Toaster } from "sonner";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WhatsAppProvider>
        <CallProvider>
          <LeadNavigationProvider>
            <CrmSyncProvider>
              <div className="min-h-dvh lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
                <AppSidebar />
                <div className="min-w-0 flex flex-col">
                  <MobileHeader />
                  <main className="page-enter mx-auto w-full max-w-[1240px] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-7 lg:px-10 lg:pb-14 lg:pt-8 flex-1">
                    {children}
                  </main>
                </div>
                <MobileNavigation />
              </div>
              <Toaster position="bottom-right" richColors />
            </CrmSyncProvider>
          </LeadNavigationProvider>
        </CallProvider>
      </WhatsAppProvider>
    </ToastProvider>
  );
}

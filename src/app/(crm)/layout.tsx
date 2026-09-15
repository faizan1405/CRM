import { AppSidebar } from "@/components/app-sidebar";
import { MobileNavigation } from "@/components/mobile-navigation";
import { LeadNavigationProvider } from "@/features/leads/lead-navigation-provider";
import { ToastProvider } from "@/components/toast-provider";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <LeadNavigationProvider><div className="min-h-dvh lg:flex">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <MobileNavigation />
          <main className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 xl:px-12">{children}</main>
        </div>
      </div></LeadNavigationProvider>
    </ToastProvider>
  );
}

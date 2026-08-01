import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DashboardFooter } from "./DashboardFooter";

interface DashboardLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
}

export function DashboardLayout({ children, hideHeader = false }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex bg-background selection:bg-primary/30">
      <Sidebar />
      <div className="flex-1 flex flex-col md:pl-72 transition-all duration-500 min-w-0">
        {!hideHeader && <Header />}
        <main className={`flex-1 min-w-0 ${hideHeader ? "h-screen pt-16 md:pt-0" : "p-4 md:p-6"}`}>
          {children}
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
}

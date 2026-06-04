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
      <div className="flex-1 flex flex-col pl-44 transition-all duration-500">
        {!hideHeader && <Header />}
        <main className={`flex-1 ${hideHeader ? "h-screen" : "p-6"}`}>
          {children}
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
}

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SubscriptionGate } from "@/components/subscription/SubscriptionGate";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useUserPreferencesStore } from "@/stores/useUserPreferencesStore";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Automation from "./pages/Automation";
import Platforms from "./pages/Platforms";
import ContentCalendar from "./pages/Calendar";
import Projects from "./pages/Projects";
import Strategies from "./pages/Strategies";
import Notes from "./pages/Notes";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import GanttChart from "./pages/GanttChart";
import Templates from "./pages/Templates";
import AIAssistant from "./pages/AIAssistant";
import UsersPage from "./pages/Users";
import ImportData from "./pages/ImportData";
import Settings from "./pages/Settings";
import Articles from "./pages/Articles";
import ContentPipeline from "./pages/ContentPipeline";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * Bridges the Zustand AppStore theme value to next-themes.
 * Must be rendered inside <ThemeProvider>.
 */
function ThemeSync() {
  const { appearance } = useUserPreferencesStore();
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(appearance.theme);
  }, [appearance.theme, setTheme]);
  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <ThemeSync />
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public pages */}
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected dashboard routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/automation" element={<ProtectedRoute><SubscriptionGate requiredTier="pro" feature="Automation Console" benefits={["AI-powered 7-day content generation", "Review and edit posts before publishing", "Approve or reject with one click", "Auto-publish to Twitter and Instagram"]}><Automation /></SubscriptionGate></ProtectedRoute>} />
              <Route path="/platforms" element={<ProtectedRoute><Platforms /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><ContentCalendar /></ProtectedRoute>} />
              <Route path="/articles" element={<ProtectedRoute><Articles /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/strategies" element={<ProtectedRoute><Strategies /></ProtectedRoute>} />
              <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><SubscriptionGate requiredTier="pro" feature="Analytics" benefits={["Post performance over time", "Platform-by-platform breakdown", "Status and engagement tracking", "Exportable trend charts"]}><Analytics /></SubscriptionGate></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><SubscriptionGate requiredTier="pro" feature="Reports" benefits={["Scheduled automated reports", "PDF and CSV export", "Content performance summaries", "Cross-platform analytics"]}><Reports /></SubscriptionGate></ProtectedRoute>} />
              <Route path="/gantt" element={<ProtectedRoute><GanttChart /></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute><SubscriptionGate requiredTier="pro" feature="AI Assistant" benefits={["Unlimited AI chat for content ideas", "Generate posts, captions, and hashtags", "One-click campaign scheduling", "Brainstorm with full context of your strategy"]}><AIAssistant /></SubscriptionGate></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><SubscriptionGate requiredTier="enterprise" feature="User Management" benefits={["Invite unlimited team members", "Role-based permissions (Admin, Editor, Viewer)", "Manage user access per workspace", "Audit team activity"]}><UsersPage /></SubscriptionGate></ProtectedRoute>} />
              <Route path="/import" element={<ProtectedRoute><ImportData /></ProtectedRoute>} />
              <Route path="/pipeline" element={<ProtectedRoute><SubscriptionGate requiredTier="pro" feature="Content Pipeline" benefits={["AI-generated posts with DALL-E images", "Publish immediately, schedule, or save as draft", "Multi-platform targeting in one run", "Webhook-powered distribution network"]}><ContentPipeline /></SubscriptionGate></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;

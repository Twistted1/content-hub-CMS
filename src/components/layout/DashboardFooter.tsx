import { Link } from "react-router-dom";

export function DashboardFooter() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-auto">
      <div className="container px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Content Hub CMS. All rights reserved.
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <Link to="/settings" className="hover:text-foreground transition-colors">Settings</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <a href="mailto:support@contenthub.io" className="hover:text-foreground transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
}

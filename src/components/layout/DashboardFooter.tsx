import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function DashboardFooter() {
  const { t } = useTranslation();
  return (
    <footer className="w-full border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-auto">
      <div className="container px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {t("footer.dashboardCopyright")}
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <Link to="/settings" className="hover:text-foreground transition-colors">{t("settings.header.title")}</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">{t("footer.legalTerms")}</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">{t("footer.legalPrivacy")}</Link>
          <a href="mailto:support@contenthub.io" className="hover:text-foreground transition-colors">{t("footer.support")}</a>
        </div>
      </div>
    </footer>
  );
}

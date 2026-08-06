import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Github, Youtube, Instagram, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const socialLinks = [
  { icon: Twitter, href: "https://x.com/novusexchange", label: "X" },
  { icon: Linkedin, href: "https://linkedin.com/company/novusexchange", label: "LinkedIn" },
  { icon: Github, href: "https://github.com/contenthubcms", label: "GitHub" },
  { icon: Youtube, href: "https://youtube.com/@novusexchange", label: "YouTube" },
  { icon: Instagram, href: "https://instagram.com/novusexchange", label: "Instagram" },
];

export function Footer() {
  const { t } = useTranslation();

  const legalLinks = [
    { label: t('footer.legalPrivacy'), href: "/privacy" },
    { label: t('footer.legalTerms'), href: "/terms" },
    { label: t('footer.legalCookies'), href: "/cookies" },
  ];

  const productLinks = [
    { label: t('footer.productFeatures'), href: "/#features" },
    { label: t('footer.productPricing'), href: "/pricing" },
    { label: t('footer.productDemo'), href: "/dashboard" },
  ];

  const companyLinks = [
    { label: t('footer.companyAbout'), href: "/#features" },
    { label: t('footer.companyContact'), href: "mailto:contact@novusexchange.com" },
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">CH</span>
              </div>
              <span className="font-bold text-xl text-foreground">{t('footer.brand')}</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('footer.productHeading')}</h4>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('footer.companyHeading')}</h4>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('footer.legalHeading')}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <h4 className="font-semibold text-foreground mb-4">{t('footer.newsletterHeading')}</h4>
            <p className="text-sm text-muted-foreground mb-3">
              {t('footer.newsletterDesc')}
            </p>
            <a
              href="mailto:contact@novusexchange.com"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              contact@novusexchange.com
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {t('footer.copyright')}
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>{t('footer.madeWith')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

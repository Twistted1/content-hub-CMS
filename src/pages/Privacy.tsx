import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { useTranslation } from 'react-i18next';

interface PolicySection {
  title: string;
  paragraphs: string[];
  items?: string[];
}

export default function Privacy() {
  const { t, i18n } = useTranslation();
  const sections = t('privacy.sections', { returnObjects: true }) as PolicySection[];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">CH</span>
            </div>
            <span className="font-bold text-xl text-foreground">{t('privacy.navBrand')}</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('privacy.backToHome')}
            </Link>
          </Button>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-foreground mb-8">{t('privacy.title')}</h1>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">
              {t('privacy.lastUpdated')} {new Date().toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            {sections.map((section, index) => (
              <section key={index} className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                {section.paragraphs.map((paragraph, pIndex) => (
                  <p key={pIndex} className="text-muted-foreground">{paragraph}</p>
                ))}
                {section.items && (
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    {section.items.map((item, iIndex) => (
                      <li key={iIndex}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">{t('privacy.contactTitle')}</h2>
              <p className="text-muted-foreground">
                {t('privacy.contactPrefix')}{' '}
                <a href={`mailto:${t('privacy.contactEmail')}`} className="text-primary hover:underline">
                  {t('privacy.contactEmail')}
                </a>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

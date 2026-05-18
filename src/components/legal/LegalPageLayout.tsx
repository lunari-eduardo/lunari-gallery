import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InternalBackground } from '@/components/InternalBackground';

interface LegalPageLayoutProps {
  title: string;
  description: string;
  canonical: string;
  updatedAt: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, description, canonical, updatedAt, children }: LegalPageLayoutProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
      return el;
    };

    const descEl = setMeta('meta[name="description"]', 'name', 'description', description);
    const ogTitle = setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    const ogDesc = setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    const ogUrl = setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);

    let canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonicalEl;
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    const prevCanonical = canonicalEl.getAttribute('href');
    canonicalEl.setAttribute('href', canonical);

    return () => {
      document.title = prevTitle;
      if (createdCanonical && canonicalEl?.parentNode) {
        canonicalEl.parentNode.removeChild(canonicalEl);
      } else if (canonicalEl && prevCanonical) {
        canonicalEl.setAttribute('href', prevCanonical);
      }
    };
  }, [title, description, canonical]);

  return (
    <div className="min-h-screen relative">
      <InternalBackground />

      <header className="sticky top-0 z-50 w-full border-b border-border/30 backdrop-blur-xl bg-white/40 dark:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" aria-label="Lunari Gallery — início">
            <Logo size="md" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="container py-10 md:py-16">
        <article className="mx-auto max-w-3xl">
          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
          </header>

          <div className="legal-prose space-y-8 text-foreground/90 leading-relaxed">
            {children}
          </div>

          <footer className="mt-16 pt-8 border-t border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex gap-4">
              <Link to="/privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link>
              <Link to="/termos" className="hover:text-foreground transition-colors">Termos de Serviço</Link>
            </div>
            <a href="mailto:contato@lunarihub.app" className="hover:text-foreground transition-colors">
              contato@lunarihub.app
            </a>
          </footer>
        </article>
      </main>
    </div>
  );
}

interface SectionProps {
  n: number;
  title: string;
  children: ReactNode;
}

export function Section({ n, title, children }: SectionProps) {
  return (
    <section>
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-base">{children}</div>
    </section>
  );
}

import { useEffect } from "react";

const DEFAULT_TITLE = "Content Hub CMS - Headless Content Management";
const DEFAULT_DESCRIPTION =
  "Manage your content across YouTube, TikTok, X, Instagram, Facebook, and LinkedIn from one powerful headless CMS dashboard.";

function setMeta(selector: string, content: string) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute("content", content);
}

/**
 * Sets this route's document title, meta description, and Open Graph
 * title/description - all of it was previously one static set in
 * index.html shared by every route, including the public marketing pages
 * (Pricing, Terms, Privacy, Cookies) search engines actually index. This
 * is a plain useEffect + DOM update rather than react-helmet-async: this
 * app is client-rendered only (no SSR), so helmet's real value -
 * SSR-safe head management - isn't needed here, and a hook avoids adding
 * a dependency for what's otherwise a few DOM writes.
 *
 * Resets to the app-wide default on unmount so a page that doesn't call
 * this (or one still loading) never leaves a stale title/description
 * behind for whatever renders next.
 */
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    const fullTitle = `${title} | Content Hub CMS`;
    document.title = fullTitle;
    setMeta('meta[property="og:title"]', fullTitle);
    if (description) {
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:description"]', description);
    }
    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('meta[property="og:title"]', DEFAULT_TITLE);
      setMeta('meta[name="description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:description"]', DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}

import { useEffect, useState } from "react";

/** normalize hash → page slug; "" = landing. "#/about" → "about". plain "#demo" stays "" (section anchor). */
function normalize(hash: string): string {
  if (hash.startsWith("#/")) {
    return hash.slice(2).replace(/\/+$/, "");
  }
  return "";
}

export function useRoute(): string {
  const [route, setRoute] = useState(() => normalize(window.location.hash));
  useEffect(() => {
    const fn = () => setRoute(normalize(window.location.hash));
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return route;
}

export function pageHref(slug: string): string {
  return `#/${slug}`;
}

/** scroll helper used by in-page TOCs (no hash changes, keeps router state clean) */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** set document title for a page */
export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

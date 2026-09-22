import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, Sparkles } from "lucide-react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import HowItWorks from "./components/HowItWorks";
import Demo from "./components/Demo";
import DataPoints from "./components/DataPoints";
import AiAssistant from "./components/AiAssistant";
import UseCases from "./components/UseCases";
import Features from "./components/Features";
import Pricing from "./components/Pricing";
import Faq from "./components/Faq";
import Cta from "./components/Cta";
import Footer from "./components/Footer";
import { GhostButton } from "./components/ui";
import { useRoute } from "./lib/router";
import { ThemeProvider } from "./lib/theme";
import { LiveDemoPage, DataPointsPage } from "./pages/ProductA";
import { AiAssistantPage, LeadListsPage, PricingPage } from "./pages/ProductB";
import Changelog from "./pages/Changelog";
import { AgenciesPage, SaasSalesPage, LocalMarketersPage } from "./pages/UseCasesA";
import { RecruitersPage, MarketplacesPage } from "./pages/UseCasesB";
import { AboutPage, PressKitPage } from "./pages/CompanyA";
import { CareersPage, ContactPage } from "./pages/CompanyB";
import { BlogPage, ArticlePage } from "./pages/BlogPages";
import { PrivacyPage, TermsPage, DpaPage, ResponsibleUsePage } from "./pages/LegalPages";
import { Page as PageShell } from "./pages/ui";
import { EngineProvider } from "./app/engine";
import { AppShell } from "./app/shell";
import { DashboardPage, FindLeadsPage } from "./app/pages1";
import { LeadsPage, LeadDetailPage } from "./app/pages2";
import { ListsPage, ListDetailPage, SearchesPage, SearchDetailPage } from "./app/pages3";
import { ZybbleAiPage, ExportsPage } from "./app/pages4";
import { BillingPage, SettingsPage } from "./app/pages5";
import { SignInPage, SignUpPage, ForgotPasswordPage, ResetPasswordPage } from "./app/auth";

/* ---------------- landing ---------------- */
function Landing() {
  return (
    <main>
      <Hero />
      <Marquee />
      <HowItWorks />
      <Demo />
      <DataPoints />
      <AiAssistant />
      <UseCases />
      <Features />
      <Pricing />
      <Faq />
      <Cta />
    </main>
  );
}

function NotFound() {
  return (
    <PageShell title="404 — zybble">
      <div className="grid min-h-[70vh] place-items-center px-4 pt-[118px]">
        <div className="text-center">
          <Compass className="mx-auto size-10 text-zest" />
          <p className="mt-4 font-mono text-sm text-zest">404 · off the map</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-bone sm:text-4xl">
            This sector returned zero results.
          </h1>
          <div className="mt-7 flex justify-center">
            <GhostButton href="#/">Take me home</GhostButton>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/* ---------------- registries ---------------- */
const MARKETING: Record<string, ComponentType> = {
  "live-demo": LiveDemoPage,
  "data-points": DataPointsPage,
  "ai-assistant": AiAssistantPage,
  "lead-lists": LeadListsPage,
  pricing: PricingPage,
  changelog: Changelog,
  agencies: AgenciesPage,
  "saas-sales": SaasSalesPage,
  "local-marketers": LocalMarketersPage,
  recruiters: RecruitersPage,
  marketplaces: MarketplacesPage,
  about: AboutPage,
  blog: BlogPage,
  careers: CareersPage,
  "press-kit": PressKitPage,
  contact: ContactPage,
  privacy: PrivacyPage,
  terms: TermsPage,
  dpa: DpaPage,
  "responsible-use": ResponsibleUsePage,
};

const APP_SIMPLE: Record<string, ComponentType> = {
  dashboard: DashboardPage,
  findleads: FindLeadsPage,
  leads: LeadsPage,
  lists: ListsPage,
  searches: SearchesPage,
  zybbleai: ZybbleAiPage,
  exports: ExportsPage,
  billing: BillingPage,
};

const APP_PARAM: Record<string, ComponentType<{ slug: string }>> = {
  lead: LeadDetailPage,
  list: ListDetailPage,
  search: SearchDetailPage,
};

const AUTH: Record<string, ComponentType> = {
  signin: SignInPage,
  signup: SignUpPage,
  forgotpassword: ForgotPasswordPage,
  resetpassword: ResetPasswordPage,
};

/* ---------------- mobile sticky CTA (landing only) ---------------- */
function MobileCtaBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setShow(y > 640 && y < max - 900);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-3 bottom-3 z-40 sm:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <a
            href="#/signup"
            className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-zest/30 bg-zest py-3.5 font-display text-[15px] font-semibold text-ink shadow-[0_16px_40px_-8px_rgba(201,241,88,0.45)] backdrop-blur active:scale-[0.98]"
          >
            <Sparkles className="size-4" />
            Get 50 free leads — no card
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- app root ---------------- */
export default function App() {
  const rawRoute = useRoute();
  const [path, queryStr] = rawRoute.split("?");
  const [seg = "", ...rest] = path.split("/");
  const param = rest.join("/");

  useEffect(() => {
    if (rawRoute !== "") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } else {
      const h = window.location.hash;
      if (h && !h.startsWith("#/") && h.length > 1) {
        requestAnimationFrame(() => {
          document.getElementById(h.slice(1))?.scrollIntoView({ behavior: "smooth" });
        });
      } else {
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
    }
  }, [rawRoute]);

  const grained = (
    <div className="grain relative min-h-screen bg-ink font-body text-bone antialiased">
      <RouterContent path={path} seg={seg} param={param} queryStr={queryStr} />
    </div>
  );

  return (
    <EngineProvider>
      <ThemeProvider>{grained}</ThemeProvider>
    </EngineProvider>
  );
}

function RouterContent({ path, seg, param, queryStr }: { path: string; seg: string; param: string; queryStr?: string }) {
  // landing
  if (path === "") {
    return (
      <>
        <Nav />
        <Landing />
        <Footer />
        <MobileCtaBar />
      </>
    );
  }

  // auth (standalone chrome)
  const AuthPage = AUTH[seg];
  if (AuthPage && !param) return <AuthPage />;

  // app area (shelled)
  const AppPage = APP_SIMPLE[seg];
  if (AppPage && !param) {
    return (
      <AppShell route={seg}>
        <AppPage />
      </AppShell>
    );
  }
  if ((seg === "setting" || seg === "settings") && !param) {
    const tab = new URLSearchParams(queryStr ?? "").get("tab") ?? undefined;
    return (
      <AppShell route="setting">
        <SettingsPage initialTab={tab} />
      </AppShell>
    );
  }
  const ParamPage = APP_PARAM[seg];
  if (ParamPage && param) {
    return (
      <AppShell route={path}>
        <ParamPage slug={param} />
      </AppShell>
    );
  }

  // marketing pages + blog
  if (seg === "blog" && param) {
    return (
      <>
        <Nav />
        <ArticlePage slug={param} />
        <Footer />
      </>
    );
  }
  const MarketingPage = MARKETING[path];
  if (MarketingPage) {
    return (
      <>
        <Nav />
        <MarketingPage />
        <Footer />
      </>
    );
  }
  return (
    <>
      <Nav />
      <NotFound />
      <Footer />
    </>
  );
}

/**
 * Knowledge Base — Reader Landing Page
 * Categories grid + prominent search. All authenticated roles see published articles.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import {
  BookOpen, Search, ChevronRight,
  Droplets, Thermometer, ShieldCheck, Anchor, Home, Zap,
  Wrench, Leaf, Sun, Cloud, AlertTriangle, Globe,
} from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

// Icon resolver
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  BookOpen, Droplets, Thermometer, ShieldCheck, Anchor, Home, Zap,
  Wrench, Leaf, Sun, Cloud, AlertTriangle, Globe,
};
function KBIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? BookOpen;
  return <Icon size={size} />;
}

const CAT_COLORS = [TERRACOTTA, SAGE, "#5A7A8C", "#8B7355", "#7B6B5A", "#5A8C7A"];

export default function KBIndexPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/faq/categories"],
    queryFn: async () => (await apiRequest("GET", "/api/faq/categories")).json(),
  });

  const { data: allArticles = [] } = useQuery<any[]>({
    queryKey: ["/api/faq/articles", "published"],
    queryFn: async () => (await apiRequest("GET", "/api/faq/articles")).json(),
  });

  // Debounced search
  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await apiRequest("GET", `/api/faq/articles?search=${encodeURIComponent(search)}`);
        setSearchResults(await r.json());
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const articlesByCategory = (catId: number) => allArticles.filter((a: any) => a.category_id === catId);

  return (
    <AppLayout title="Knowledge Base" subtitle="How-to guides for your lake property">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-4">
          <div className="flex justify-center mb-3">
            <div className="rounded-full p-3" style={{ background: `${TERRACOTTA}18`, border: `1px solid ${TERRACOTTA}33` }}>
              <BookOpen size={28} style={{ color: TERRACOTTA }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
            Property Knowledge Base
          </h1>
          <p className="text-base" style={{ color: "#888" }}>
            Free how-to guides for your lake property — and if you'd rather have us handle it, we're one click away.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative max-w-xl mx-auto">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "#555" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search articles by title, topic, or keyword…"
            className="w-full rounded-2xl py-3 pl-11 pr-4 text-base outline-none"
            style={{ background: "#1a1a1a", border: `1px solid ${search ? TERRACOTTA : CARD_BORDER}`, color: CREAM }}
          />
          {search && (
            <button onClick={() => { setSearch(""); setSearchResults(null); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#555" }}>✕</button>
          )}
        </div>

        {/* Search results */}
        {(search.trim() && searchResults !== null) ? (
          <div>
            <p className="text-sm mb-3" style={{ color: "#666" }}>
              {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${search}"`}
            </p>
            {searchResults.length === 0 ? (
              <div className="text-center py-10" style={{ color: "#555" }}>No articles found. Try a different term.</div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((a: any) => (
                  <button key={a.id} onClick={() => setLocation(`/kb/${a.slug}`)}
                    className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                    style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                    <BookOpen size={16} style={{ color: TERRACOTTA, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: CREAM }}>{a.title}</div>
                      <div className="text-xs" style={{ color: "#555" }}>{a.category_name}</div>
                    </div>
                    <ChevronRight size={14} style={{ color: "#555", flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Category grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat: any, ci: number) => {
              const arts = articlesByCategory(cat.id);
              const color = CAT_COLORS[ci % CAT_COLORS.length];
              return (
                <div key={cat.id} className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                  {/* Category header */}
                  <div className="px-4 py-4 flex items-center gap-3"
                    style={{ background: `${color}12`, borderBottom: `1px solid ${color}22` }}>
                    <div className="rounded-xl p-2.5" style={{ background: `${color}20` }}>
                      <KBIcon name={cat.icon} size={20} />
                    </div>
                    <div>
                      <h2 className="font-bold text-base" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>{cat.name}</h2>
                      <p className="text-xs" style={{ color: "#666" }}>{arts.length} article{arts.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {/* Article list */}
                  <div className="flex-1 divide-y" style={{ borderColor: "#1a1a1a" }}>
                    {arts.slice(0, 4).map((a: any) => (
                      <button key={a.id} onClick={() => setLocation(`/kb/${a.slug}`)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors">
                        <span className="flex-1 text-sm truncate" style={{ color: "#ccc" }}>{a.title}</span>
                        <ChevronRight size={12} style={{ color: "#444", flexShrink: 0 }} />
                      </button>
                    ))}
                    {arts.length > 4 && (
                      <div className="px-4 py-2 text-xs" style={{ color: "#444" }}>+{arts.length - 4} more</div>
                    )}
                    {arts.length === 0 && (
                      <div className="px-4 py-3 text-xs" style={{ color: "#444" }}>No articles yet</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

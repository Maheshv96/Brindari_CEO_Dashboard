"use client";

import { useState, useEffect } from "react";
import {
  Share2, Globe, ThumbsUp, MessageCircle, Repeat2, Users,
  Target, Calendar, MapPin, TrendingUp, Edit3, Check, X,
  ChevronRight, Eye, Link2, Package, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface KpiData {
  postsScheduled: number;
  postsPublished: number;
  estimatedReach: number;
  likes: number;
  comments: number;
  shares: number;
  groupsPosted: number;
  sampleLeads: number;
  linkClicks: number;
  profileViews: number;
}

interface ScheduledPost {
  id: string;
  platform: "facebook" | "linkedin";
  scheduledAt: string;
  caption: string;
  type: string;
  status: "scheduled" | "published" | "draft";
  reach?: number;
  likes?: number;
  comments?: number;
}

interface GroupEntry {
  name: string;
  members: string;
  posted: boolean;
  category: string;
}

// ── Default data ──────────────────────────────────────────────────────────────
const DEFAULT_FB_KPI: KpiData = {
  postsScheduled: 2,
  postsPublished: 0,
  estimatedReach: 6000,
  likes: 0,
  comments: 0,
  shares: 0,
  groupsPosted: 0,
  sampleLeads: 0,
  linkClicks: 0,
  profileViews: 0,
};


const SCHEDULED_POSTS: ScheduledPost[] = [
  {
    id: "sun-1pm",
    platform: "facebook",
    scheduledAt: "2026-09-13T07:30:00Z", // 1 PM IST
    caption: "💚 Attention wellness brands & supplement makers: Are you looking for a reliable moringa ingredient supplier with full documentation? Brindari Global supplies Moringa Leaf Powder, Dried Moringa Leaf, Moringa Seed Oil, and Moringa Tea Bags. FSSAI Registered · APEDA RCMC Certified · Lab-tested.",
    type: "Wellness Brand Outreach",
    status: "scheduled",
  },
  {
    id: "sun-6pm",
    platform: "facebook",
    scheduledAt: "2026-09-13T12:30:00Z", // 6 PM IST
    caption: "📦 Bulk moringa buyers — before you commit to a 100kg+ order, start with a FREE sample. We understand large import decisions need confidence. 100g–500g premium moringa powder · Full Certificate of Analysis (CoA) · FSSAI & APEDA certification documents.",
    type: "Bulk Buyer Free Sample CTA",
    status: "scheduled",
  },
];

const FACEBOOK_GROUPS: GroupEntry[] = [
  { name: "Moringa & Superfood Wholesale Buyers", members: "12.4K", posted: false, category: "Buyers" },
  { name: "Herbal Export & Import Business", members: "8.9K", posted: false, category: "Export" },
  { name: "Organic Health Products Suppliers", members: "15.2K", posted: false, category: "Suppliers" },
  { name: "Nutraceuticals & Functional Foods B2B", members: "6.7K", posted: false, category: "B2B" },
  { name: "Supplement Manufacturing Network", members: "9.3K", posted: false, category: "Manufacturers" },
  { name: "International Food & Herb Importers", members: "11.1K", posted: false, category: "Importers" },
  { name: "Wellness Brand Owners & Founders", members: "22.5K", posted: false, category: "Brands" },
  { name: "UAE Health & Wellness Trade", members: "4.2K", posted: false, category: "UAE" },
  { name: "German Natural Products Importers", members: "3.8K", posted: false, category: "Germany" },
  { name: "UK Organic & Natural Trade", members: "5.1K", posted: false, category: "UK" },
  { name: "Australia Natural Health Business", members: "4.6K", posted: false, category: "Australia" },
  { name: "Malaysia Herbal & Health Products", members: "7.3K", posted: false, category: "Malaysia" },
  { name: "B2B Food & Beverage Ingredients", members: "18.9K", posted: false, category: "B2B" },
  { name: "Export Import India Business Network", members: "32.1K", posted: false, category: "Export" },
  { name: "Moringa Farmers & Producers Global", members: "6.4K", posted: false, category: "Producers" },
  { name: "Health Food Retail & Wholesale", members: "13.7K", posted: false, category: "Retail" },
  { name: "Ayurveda & Natural Health Products", members: "9.8K", posted: false, category: "Ayurveda" },
  { name: "Plant-Based Nutrition Entrepreneurs", members: "16.4K", posted: false, category: "Brands" },
  { name: "Global Superfoods Trade Network", members: "5.9K", posted: false, category: "B2B" },
];

const GOALS = {
  weeklyPosts: 6,
  monthlyReach: 50000,
  monthlyLeads: 15,
  groupsCovered: 19,
};

// ── Helper: load/save from localStorage ──────────────────────────────────────
function loadFromStorage<T>(key: string, defaultVal: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function saveToStorage<T>(key: string, val: T) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, sub, icon: Icon, color, goal, editable, onEdit,
}: {
  title: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  goal?: number;
  editable?: boolean;
  onEdit?: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : null;

  function commit() {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && onEdit) onEdit(n);
    setEditing(false);
  }

  return (
    <div className="card p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          {editing ? (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                className="w-24 rounded-md border border-emerald-300 px-2 py-1 text-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                autoFocus
              />
              <button onClick={commit} className="text-emerald-600 hover:text-emerald-700"><Check className="h-4 w-4" /></button>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 mt-1">
              <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
              {goal && <p className="text-xs text-gray-400">/ {goal.toLocaleString()}</p>}
            </div>
          )}
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shrink-0", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {pct !== null && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>Progress</span><span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className={cn("h-1.5 rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-rose-400")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {editable && !editing && (
        <button onClick={() => { setDraft(String(value)); setEditing(true); }}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-emerald-600 transition-colors self-start">
          <Edit3 className="h-3 w-3" /> Update
        </button>
      )}
    </div>
  );
}

// ── Post row ──────────────────────────────────────────────────────────────────
function PostRow({ post }: { post: ScheduledPost }) {
  const dt = new Date(post.scheduledAt);
  // Display in IST
  const istStr = dt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
        <div className={cn("h-2 w-2 rounded-full mt-1",
          post.status === "published" ? "bg-emerald-500" :
          post.status === "scheduled" ? "bg-blue-400" : "bg-gray-300")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
            post.status === "published" ? "bg-emerald-100 text-emerald-700" :
            post.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
          )}>
            {post.status === "published" ? "✓ Published" : post.status === "scheduled" ? "🕐 Scheduled" : "Draft"}
          </span>
          <span className="text-xs font-medium text-gray-600">{post.type}</span>
          <span className="text-xs text-gray-400">{istStr} IST</span>
        </div>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">{post.caption}</p>
        {post.reach !== undefined && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.reach.toLocaleString()} reach</span>
            <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{post.likes ?? 0}</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{post.comments ?? 0}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Facebook Tab ──────────────────────────────────────────────────────────────
function FacebookTab() {
  const [kpi, setKpi] = useState<KpiData>(DEFAULT_FB_KPI);
  const [groups, setGroups] = useState<GroupEntry[]>(FACEBOOK_GROUPS);
  const [posts, setPosts] = useState<ScheduledPost[]>(SCHEDULED_POSTS.filter(p => p.platform === "facebook"));
  const [groupFilter, setGroupFilter] = useState("All");

  useEffect(() => {
    setKpi(loadFromStorage("brindari_fb_kpi", DEFAULT_FB_KPI));
    setGroups(loadFromStorage("brindari_fb_groups", FACEBOOK_GROUPS));
    setPosts(loadFromStorage("brindari_fb_posts", SCHEDULED_POSTS.filter(p => p.platform === "facebook")));
  }, []);

  function updateKpi(key: keyof KpiData, val: number) {
    const next = { ...kpi, [key]: val };
    setKpi(next);
    saveToStorage("brindari_fb_kpi", next);
  }

  function toggleGroup(i: number) {
    const next = groups.map((g, idx) => idx === i ? { ...g, posted: !g.posted } : g);
    setGroups(next);
    saveToStorage("brindari_fb_groups", next);
    // Update KPI
    const postedCount = next.filter(g => g.posted).length;
    updateKpi("groupsPosted", postedCount);
  }

  const categories = ["All", ...Array.from(new Set(FACEBOOK_GROUPS.map(g => g.category)))];
  const filteredGroups = groupFilter === "All" ? groups : groups.filter(g => g.category === groupFilter);
  const postedCount = groups.filter(g => g.posted).length;
  const totalReachFromGroups = groups.filter(g => g.posted).length * 3000; // avg ~3K per group

  return (
    <div className="space-y-8">
      {/* Strategy summary banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="h-4 w-4 text-blue-200" />
          <span className="text-sm font-semibold">Facebook Growth Strategy — Active</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
          {[
            { label: "Post times", value: "9 AM · 1 PM · 6 PM IST" },
            { label: "Target reach/post", value: "3,000–8,000" },
            { label: "Monthly goal", value: "50K reach · 15 leads" },
            { label: "Group strategy", value: "19 groups · rotating" },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-white/10 px-3 py-2">
              <p className="text-blue-200 text-[10px] uppercase tracking-wide mb-0.5">{s.label}</p>
              <p className="font-semibold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Performance KPIs</h2>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Edit3 className="h-3 w-3" /> Click &quot;Update&quot; to log actuals</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard title="Posts Scheduled" value={kpi.postsScheduled} icon={Calendar} color="bg-blue-50 text-blue-600" editable onEdit={v => updateKpi("postsScheduled", v)} />
          <KpiCard title="Posts Published" value={kpi.postsPublished} goal={GOALS.weeklyPosts} icon={Check} color="bg-emerald-50 text-emerald-600" editable onEdit={v => updateKpi("postsPublished", v)} />
          <KpiCard title="Est. Reach" value={kpi.estimatedReach} goal={GOALS.monthlyReach} sub="Monthly target: 50K" icon={Eye} color="bg-indigo-50 text-indigo-600" editable onEdit={v => updateKpi("estimatedReach", v)} />
          <KpiCard title="Likes / Reactions" value={kpi.likes} icon={ThumbsUp} color="bg-pink-50 text-pink-600" editable onEdit={v => updateKpi("likes", v)} />
          <KpiCard title="Comments" value={kpi.comments} icon={MessageCircle} color="bg-amber-50 text-amber-600" editable onEdit={v => updateKpi("comments", v)} />
          <KpiCard title="Shares" value={kpi.shares} icon={Repeat2} color="bg-purple-50 text-purple-600" editable onEdit={v => updateKpi("shares", v)} />
          <KpiCard title="Groups Posted" value={postedCount} goal={GOALS.groupsCovered} sub={`${GOALS.groupsCovered} groups total`} icon={Users} color="bg-teal-50 text-teal-600" />
          <KpiCard title="Sample Leads" value={kpi.sampleLeads} goal={GOALS.monthlyLeads} sub="'BULK SAMPLE' comments" icon={Package} color="bg-orange-50 text-orange-600" editable onEdit={v => updateKpi("sampleLeads", v)} />
          <KpiCard title="Link Clicks" value={kpi.linkClicks} sub="brindari.com clicks" icon={Link2} color="bg-cyan-50 text-cyan-600" editable onEdit={v => updateKpi("linkClicks", v)} />
          <KpiCard title="Profile Views" value={kpi.profileViews} icon={TrendingUp} color="bg-violet-50 text-violet-600" editable onEdit={v => updateKpi("profileViews", v)} />
        </div>
      </div>

      {/* Target Countries */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Globe className="h-4 w-4 text-emerald-600" /> Target Markets</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { flag: "🇩🇪", country: "Germany", priority: "High" },
            { flag: "🇦🇪", country: "UAE", priority: "High" },
            { flag: "🇬🇧", country: "UK", priority: "High" },
            { flag: "🇦🇺", country: "Australia", priority: "Medium" },
            { flag: "🇲🇾", country: "Malaysia", priority: "Medium" },
            { flag: "🇺🇸", country: "USA", priority: "Medium" },
          ].map(m => (
            <div key={m.country} className="rounded-lg bg-gray-50 px-3 py-2.5 text-center">
              <span className="text-2xl">{m.flag}</span>
              <p className="text-xs font-semibold text-gray-700 mt-1">{m.country}</p>
              <span className={cn("text-[10px] font-medium",
                m.priority === "High" ? "text-emerald-600" : "text-amber-600"
              )}>{m.priority}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Posts */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" /> Post Schedule
          </h2>
          <span className="text-xs text-gray-400">{posts.filter(p => p.status === "scheduled").length} scheduled · {posts.filter(p => p.status === "published").length} published</span>
        </div>

        {posts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No posts yet. Schedule your first post on Facebook.</p>
        ) : (
          <div>
            {posts.map(p => <PostRow key={p.id} post={p} />)}
          </div>
        )}

        {/* Upcoming schedule hint */}
        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-xs font-semibold text-blue-800 mb-1.5">📅 Magic Outreach Times (IST)</p>
          <div className="flex gap-3 text-xs text-blue-700">
            <span className="flex items-center gap-1">⏰ <strong>9:00 AM</strong> — Morning audience</span>
            <span className="flex items-center gap-1">⏰ <strong>1:00 PM</strong> — Lunch scroll</span>
            <span className="flex items-center gap-1">⏰ <strong>6:00 PM</strong> — Evening peak</span>
          </div>
        </div>
      </div>

      {/* Groups Tracker */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-500" /> Facebook Groups Tracker
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{postedCount} / {groups.length} posted · Est. reach: {totalReachFromGroups.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setGroupFilter(c)}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  groupFilter === c ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          {filteredGroups.map((g) => {
            const realIdx = groups.findIndex(gr => gr.name === g.name);
            return (
              <div key={g.name} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer",
                g.posted ? "bg-emerald-50 hover:bg-emerald-100" : "bg-gray-50 hover:bg-gray-100"
              )} onClick={() => toggleGroup(realIdx)}>
                <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                  g.posted ? "bg-emerald-500 border-emerald-500" : "bg-white border-gray-300")}>
                  {g.posted && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", g.posted ? "text-emerald-800" : "text-gray-700")}>{g.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{g.category}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Users className="h-3 w-3" />{g.members}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5">
          <p className="text-xs text-amber-700"><strong>⚠️ Group Rotation:</strong> Never post the same content to more than 3–4 groups per day. Vary captions slightly to avoid Facebook spam detection.</p>
        </div>
      </div>
    </div>
  );
}

// ── LinkedIn Tab (placeholder) ────────────────────────────────────────────────
function LinkedInTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-[#0077B5] to-[#0099D6] px-5 py-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="h-4 w-4 text-blue-200" />
          <span className="text-sm font-semibold">LinkedIn B2B Strategy — Coming Soon</span>
        </div>
        <p className="text-sm text-blue-100">LinkedIn targeting is planned for Phase 2. The strategy covers decision-maker outreach to procurement heads, import managers, and sourcing directors at nutraceutical companies in Germany, UAE, and UK.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { emoji: "🎯", title: "Target Audience", items: ["Procurement Managers", "Import Directors", "Sourcing Heads", "Nutraceutical CEOs", "Health Brand Founders"] },
          { emoji: "📋", title: "Planned Content Types", items: ["Company showcase posts", "Moringa nutrition facts", "Certification highlights", "Export process explainers", "Client testimonials"] },
          { emoji: "🌍", title: "Target Markets", items: ["Germany — DACH region", "UAE — GCC distributors", "UK — Natural health brands", "Australia — Supplement makers", "Malaysia — Halal market"] },
          { emoji: "📈", title: "Monthly Goals (Phase 2)", items: ["50+ connection requests/week", "5 InMail messages/day", "10 posts/month", "3 leads from LinkedIn/month", "500 profile views/month"] },
        ].map(section => (
          <div key={section.title} className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{section.emoji} {section.title}</h3>
            <ul className="space-y-1.5">
              {section.items.map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card p-5 text-center py-10">
        <BarChart2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-400">LinkedIn tracking will activate once the company page is set up.</p>
        <p className="text-xs text-gray-300 mt-1">KPIs will appear here: connections, impressions, profile views, InMail replies, and leads generated.</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = "facebook" | "linkedin";

export default function SocialMarketingPage() {
  const [tab, setTab] = useState<Tab>("facebook");

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Marketing</h1>
          <p className="mt-0.5 text-sm text-gray-400 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-emerald-600" />
            Facebook · LinkedIn · KPI tracking · Post schedule · Group outreach
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <MapPin className="h-3.5 w-3.5" />
          <span>All times in IST (UTC+5:30)</span>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {([
          { id: "facebook", label: "Facebook", emoji: "📘" },
          { id: "linkedin", label: "LinkedIn", emoji: "💼" },
        ] as { id: Tab; label: string; emoji: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              tab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
            {t.id === "linkedin" && (
              <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">Soon</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "facebook" ? <FacebookTab /> : <LinkedInTab />}
    </div>
  );
}

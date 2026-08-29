import React, { useState, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePosts } from "@/hooks/usePosts";
import { useUJT } from "@/hooks/useUJT";
import { DragDropImport } from "@/components/common/DragDropImport";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { parseISO, format } from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, Search, CalendarDays, Send, AlarmClock,
  Clapperboard, Briefcase, Users as UsersIcon, Sprout, Diamond, Globe,
} from "lucide-react";
import { BrandIcon } from "@/components/platforms/BrandIcon";
import { getWebsiteCategoryForDate } from "@/utils/scheduling";
import { getPlatformLimit } from "@/utils/platformLimits";
import { useTranslation } from "react-i18next";
import { useUserPreferencesStore } from "@/stores/useUserPreferencesStore";

/* ── helpers ────────────────────────────────────────────── */

function getDaysInMonth(year: number, month: number) {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  for (let i = 0; i < firstDay.getDay(); i++) days.push(new Date(year, month, -firstDay.getDay() + i + 1));
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) days.push(new Date(year, month + 1, i));
  return days;
}

function getWeekDays(date: Date) {
  const days: Date[] = [];
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
  return days;
}

function fmtKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function isSame(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function isToday(d: Date) { return isSame(d, new Date()); }
function fmt12(t: string, format: "12h" | "24h" = "12h") {
  const [h, m] = t.split(":").map(Number);
  if (format === "24h") return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function fmtHour(t: string, format: "12h" | "24h" = "12h") {
  if (format === "24h") return t.slice(0, 5);
  const h = parseInt(t.split(":")[0]);
  return `${h % 12 || 12} ${h >= 12 ? "pm" : "am"}`;
}
function splitScheduledAt(raw?: string | null) {
  if (!raw) return { date: fmtKey(new Date()), startTime: "" };
  const [datePart, timePart = ""] = raw.split("T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return { date: datePart, startTime: timePart.slice(0, 5) };
  const d = parseISO(raw);
  return { date: fmtKey(d), startTime: format(d, "HH:mm") };
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const DAYS_SHORT = ["S","M","T","W","T","F","S"];

/* ── category / platform config ─────────────────────────── */

type CatKey = "content" | "publish" | "meeting" | "deadline" | "personal" | "awaiting_review";

const CAT: Record<CatKey, { color: string; bg: string; border: string; label: string; Icon: any; iconBg: string; iconColor: string }> = {
  content:  { color: "text-primary",      bg: "bg-primary/10",    border: "border-primary/20",   label: "Content",   Icon: Clapperboard, iconBg: "bg-primary/10",    iconColor: "text-primary" },
  publish:  { color: "text-warn",   bg: "bg-warn/10",  border: "border-warn/20", label: "Publish",   Icon: Briefcase,    iconBg: "bg-warn/10",   iconColor: "text-warn" },
  meeting:  { color: "text-info",    bg: "bg-info/10",   border: "border-info/20",  label: "Meetings",  Icon: UsersIcon,    iconBg: "bg-info/10",    iconColor: "text-info" },
  deadline: { color: "text-destructive",     bg: "bg-destructive/10",    border: "border-destructive/20",   label: "Deadlines", Icon: AlarmClock,   iconBg: "bg-destructive/10",     iconColor: "text-destructive" },
  personal: { color: "text-success", bg: "bg-success/10", border: "border-success/20", label: "Personal", Icon: Sprout,      iconBg: "bg-success/10", iconColor: "text-success" },
  awaiting_review: { color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Needs Review", Icon: AlarmClock, iconBg: "bg-orange-500/10", iconColor: "text-orange-400" },
};

const PLAT: Record<string, { bar: string; card: string; accent: string; iconColor: string; badge: string; badgeText: string; label: string; short: string; Icon: any }> = {
  youtube:   { bar: "bg-red-800/15 border-l-4 border-red-800", card: "bg-red-800 text-white shadow-red-800/25", accent: "0 60% 32%", iconColor: "text-red-500", badge: "bg-red-800 shadow-lg shadow-red-800/30", badgeText: "text-white", label: "YouTube", short: "YT", Icon: (props: any) => <BrandIcon name="youtube" {...props} /> },
  tiktok:    { bar: "bg-black/30 border-l-4 border-black", card: "bg-black text-white shadow-black/40", accent: "0 0% 0%", iconColor: "text-white", badge: "bg-black shadow-lg shadow-black/40", badgeText: "text-white", label: "TikTok", short: "TT", Icon: (props: any) => <BrandIcon name="tiktok" {...props} /> },
  instagram: { bar: "bg-pink-800/15 border-l-4 border-pink-800", card: "bg-pink-800 text-white shadow-pink-800/25", accent: "335 55% 32%", iconColor: "text-pink-400", badge: "bg-pink-800 shadow-lg shadow-pink-800/30", badgeText: "text-white", label: "Instagram", short: "IG", Icon: (props: any) => <BrandIcon name="instagram" {...props} /> },
  twitter:   { bar: "bg-blue-800/15 border-l-4 border-blue-800", card: "bg-blue-800 text-white shadow-blue-800/25", accent: "203 65% 32%", iconColor: "text-blue-400", badge: "bg-blue-800 shadow-lg shadow-blue-800/30", badgeText: "text-white", label: "Twitter/X", short: "X", Icon: (props: any) => <BrandIcon name="twitter" {...props} /> },
  x:         { bar: "bg-blue-800/15 border-l-4 border-blue-800", card: "bg-blue-800 text-white shadow-blue-800/25", accent: "203 65% 32%", iconColor: "text-blue-400", badge: "bg-blue-800 shadow-lg shadow-blue-800/30", badgeText: "text-white", label: "Twitter/X", short: "X", Icon: (props: any) => <BrandIcon name="twitter" {...props} /> },
  facebook:  { bar: "bg-blue-900/15 border-l-4 border-blue-900", card: "bg-blue-900 text-white shadow-blue-900/25", accent: "214 65% 28%", iconColor: "text-blue-400", badge: "bg-blue-900 shadow-lg shadow-blue-900/30", badgeText: "text-white", label: "Facebook", short: "FB", Icon: (props: any) => <BrandIcon name="facebook" {...props} /> },
  linkedin:  { bar: "bg-sky-900/15 border-l-4 border-sky-900", card: "bg-sky-900 text-white shadow-sky-900/25", accent: "210 65% 24%", iconColor: "text-blue-500", badge: "bg-sky-900 shadow-lg shadow-sky-900/30", badgeText: "text-white", label: "LinkedIn", short: "LI", Icon: (props: any) => <BrandIcon name="linkedin" {...props} /> },
  website:   { bar: "bg-website/15 border-l-4 border-website", card: "bg-website text-white shadow-website/25", accent: "160 84% 39%", iconColor: "text-website", badge: "bg-website shadow-lg shadow-website/30", badgeText: "text-white", label: "Website", short: "WEB", Icon: Globe },
  rumble:    { bar: "bg-rumble/15 border-l-4 border-rumble", card: "bg-rumble text-white shadow-rumble/25", accent: "89 53% 52%", iconColor: "text-rumble", badge: "bg-rumble shadow-lg shadow-rumble/30", badgeText: "text-white", label: "Rumble", short: "RUM", Icon: (props: any) => <BrandIcon name="rumble" {...props} /> },
  podcast:   { bar: "bg-podcast/15 border-l-4 border-podcast", card: "bg-podcast text-white shadow-podcast/25", accent: "270 77% 54%", iconColor: "text-podcast", badge: "bg-podcast shadow-lg shadow-podcast/30", badgeText: "text-white", label: "Podcast", short: "POD", Icon: (props: any) => <BrandIcon name="podcast" {...props} /> },
};

function getBarColor(evt: CalEvent) {
  if (evt.platform && evt.platform !== "none" && PLAT[evt.platform]) return PLAT[evt.platform].bar;
  const c = CAT[evt.category as CatKey];
  return c ? c.bg : "bg-brand-accent/20";
}

function getCatStyle(evt: CalEvent) {
  return CAT[evt.category as CatKey] || CAT.content;
}

/* ── event type ──────────────────────────────────────────── */

interface CalEvent {
  id: string;
  originalId: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string;
  category: string;
  status: string;
  platform: string;
  completed: boolean;
  allDay: boolean;
  imageUrl?: string;
  caption: string;
  isTemplate?: boolean;
}

function getEventsForDay(events: CalEvent[], day: Date) {
  return events.filter(e => e.date === fmtKey(day)).sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });
}

/* ── filters ─────────────────────────────────────────────── */

function getFilters(t: (key: string) => string): { value: string; label: string; cat?: CatKey }[] {
  return [
    { value: "all",      label: t("calendar.catAll") },
    { value: "content",  label: t("calendar.catContent"),   cat: "content" },
    { value: "publish",  label: t("calendar.catPublish"),   cat: "publish" },
    { value: "meeting",  label: t("calendar.catMeetings"),  cat: "meeting" },
    { value: "deadline", label: t("calendar.catDeadlines"), cat: "deadline" },
    { value: "personal", label: t("calendar.catPersonal"),  cat: "personal" },
  ];
}

/* ── mini calendar ───────────────────────────────────────── */

function MiniCal({ current, selected, events, onSelect, onNav }: { current: Date; selected: Date; events: CalEvent[]; onSelect: (d: Date) => void; onNav: (dir: number) => void }) {
  const days = getDaysInMonth(current.getFullYear(), current.getMonth());
  return (
    <div className="w-full glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={() => onNav(-1)} aria-label="Previous Month" className="w-7 h-7 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex items-center justify-center transition-all">‹</button>
        <span className="text-xs font-black text-foreground tracking-[0.2em] uppercase">{MONTHS[current.getMonth()].slice(0,3)} {current.getFullYear()}</span>
        <button onClick={() => onNav(1)} aria-label="Next Month" className="w-7 h-7 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex items-center justify-center transition-all">›</button>
      </div>
      <div className="grid grid-cols-7 justify-items-center mb-2">
        {DAYS_SHORT.map((d, i) => <div key={i} className="text-center text-[10px] text-muted-foreground font-black py-1 w-7">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 justify-items-center">
        {days.map((day, i) => {
          const sel = isSame(day, selected);
          const today = isToday(day);
          const hasEvt = events.some(e => e.date === fmtKey(day));
          const inMonth = day.getMonth() === current.getMonth();
          return (
            <button
              key={i}
              onClick={() => onSelect(new Date(day))}
              className={`relative flex items-center justify-center w-7 h-7 rounded-xl text-xs font-bold transition-all
                ${today ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : sel ? "bg-foreground/20 text-foreground" : inMonth ? "text-muted-foreground hover:bg-foreground/5 hover:text-foreground" : "text-foreground/10"}`}
            >
              {day.getDate()}
              {hasEvt && !today && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary/60" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── sidebar ─────────────────────────────────────────────── */

function CalSidebar({ events, miniMonth, selectedDate, onSelectDate, onNavMonth, onAddEvent, onClickEvent, filter, onFilter }: any) {
  const { t } = useTranslation();
  const { appearance } = useUserPreferencesStore();
  const FILTERS = getFilters(t);
  const todayEvents = getEventsForDay(events, new Date());
  const done = todayEvents.filter((e: CalEvent) => e.completed).length;

  return (
    <aside className="flex flex-col gap-5 overflow-y-auto pb-6 h-full pr-1 custom-scrollbar">
      <MiniCal current={miniMonth} selected={selectedDate} events={events} onSelect={onSelectDate} onNav={onNavMonth} />

      {/* Filter by type */}
      <div className="w-full glass-card rounded-2xl p-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-4 px-1">{t("calendar.filterStream")}</h3>
        <div className="space-y-1.5">
          {FILTERS.map(f => {
            const active = filter === f.value;
            const count = f.value === "all" ? events.length : events.filter((e: CalEvent) => e.category === f.value).length;
            const cat = f.cat ? CAT[f.cat] : null;
            return (
              <button
                key={f.value}
                onClick={() => onFilter(f.value)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group
                  ${active ? "bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5" : "text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"}`}
              >
                <span className="flex items-center gap-3">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${cat ? cat.iconBg : "bg-foreground/[0.10]"} ${active ? "scale-110" : "group-hover:scale-105"}`}>
                    {cat ? <cat.Icon className={`w-4 h-4 ${cat.iconColor}`} /> : <Diamond className="w-4 h-4 text-primary" />}
                  </span>
                  {f.label}
                </span>
                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black transition-all ${active ? "bg-primary/20 text-primary" : "bg-foreground/[0.10] text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's agenda */}
      <div className="w-full glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em]">{t("calendar.liveQueue")}</h3>
          <span className="text-[10px] text-muted-foreground font-bold">{done}/{todayEvents.length} {t("calendar.ready")}</span>
        </div>
        {todayEvents.length > 0 && (
          <div className="h-1.5 bg-foreground/[0.10] rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${todayEvents.length > 0 ? (done / todayEvents.length) * 100 : 0}%` }}
            />
          </div>
        )}
        <div className="space-y-3">
          {todayEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Sprout className="w-10 h-10 text-foreground/[0.10] mb-3" />
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40 italic">{t("calendar.nothingQueued")}</p>
            </div>
          )}
          {todayEvents.map((evt: CalEvent) => {
            const p = PLAT[evt.platform];
            const cat = CAT[evt.category as CatKey] || CAT.content;
            return (
              <div
                key={evt.id}
                onClick={() => onClickEvent(evt)}
                className={`relative rounded-2xl overflow-hidden cursor-pointer group transition-all hover:translate-x-1 glass-hover border border-foreground/[0.10] ${cat.bg.replace('/10', '/5')}`}
              >
                <div className="px-4 py-3.5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${evt.completed ? "bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "border-foreground/20"}`} />
                    <p className={`text-xs font-bold truncate tracking-tight ${evt.completed ? "line-through text-muted-foreground/60" : "text-foreground"}`}>{evt.title}</p>
                  </div>
                  <div className="flex items-center justify-between ml-7">
                    {evt.startTime && (
                      <p className="text-[10px] text-muted-foreground font-black">
                        {fmt12(evt.startTime, appearance.timeFormat)}
                      </p>
                    )}
                    {p && (
                      <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-widest ${p.badge} ${p.badgeText}`}>
                        <p.Icon className="w-2.5 h-2.5" />
                        {p.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/* ── month grid ──────────────────────────────────────────── */

function MonthGrid({ current, events, categoryFilter, onClickDay, onClickEvent, onDropEvent }: any) {
  const { t } = useTranslation();
  const { appearance } = useUserPreferencesStore();
  const days = getDaysInMonth(current.getFullYear(), current.getMonth());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-foreground/[0.03] rounded-[2.5rem] border border-foreground/[0.10] overflow-hidden">
      <div className="grid grid-cols-7 text-center text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-[0.05em] md:tracking-[0.3em] py-2 md:py-5 border-b border-foreground/[0.10] sticky top-0 bg-background/80 backdrop-blur-3xl z-10">
        {DAYS.map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="flex-1 grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvts = getEventsForDay(events, day).filter((e: CalEvent) => categoryFilter === "all" || e.category === categoryFilter);
          const visibleEvents = dayEvts.slice(0, 5);
          const hiddenCount = Math.max(0, dayEvts.length - visibleEvents.length);
          const inMonth = day.getMonth() === current.getMonth();
          const today = isToday(day);
          const dayKey = fmtKey(day);
          const isDropTarget = dragOverKey === dayKey;

          return (
            <div
              key={i}
              onClick={() => onClickDay(new Date(day))}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverKey !== dayKey) setDragOverKey(dayKey); }}
              onDragLeave={() => { if (dragOverKey === dayKey) setDragOverKey(null); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/event-id");
                setDragOverKey(null);
                setDraggingId(null);
                if (id && onDropEvent) onDropEvent(id, new Date(day));
              }}
              className={`min-h-[64px] md:min-h-[150px] p-1.5 md:p-3 border-r border-b border-foreground/[0.07] cursor-pointer transition-all group relative
                ${!inMonth ? "opacity-10 pointer-events-none" : ""}
                ${isDropTarget ? "bg-primary/10 ring-2 ring-inset ring-primary/40 shadow-[inset_0_0_50px_rgba(var(--primary),0.1)]" : today ? "bg-primary/[0.02]" : "hover:bg-foreground/[0.035]"}`}
            >
              <div className="flex justify-between items-start mb-1 md:mb-3">
                <span className={`inline-flex items-center justify-center w-5 h-5 md:w-8 md:h-8 rounded-md md:rounded-xl text-[10px] md:text-xs font-black transition-all
                  ${today ? "bg-primary text-primary-foreground shadow-xl shadow-primary/40 scale-110" : inMonth ? "text-muted-foreground group-hover:text-foreground group-hover:scale-105" : "text-foreground/5"}`}>
                  {day.getDate()}
                </span>
                {dayEvts.length > 0 && <span className="hidden md:inline rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">{dayEvts.length}</span>}
              </div>
              <div className="space-y-0.5 md:space-y-1.5">
                {visibleEvents.map((evt: CalEvent) => {
                  const p = PLAT[evt.platform];
                  const isReview = evt.status === "awaiting_review";
                  const isDragging = draggingId === evt.id;
                  return (
                    <div
                      key={evt.id}
                      draggable={!evt.isTemplate}
                      onDragStart={(e) => {
                        if (evt.isTemplate) return;
                        e.stopPropagation();
                        e.dataTransfer.setData("text/event-id", evt.originalId || evt.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(evt.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverKey(null); }}
                      onClick={(e) => { e.stopPropagation(); if (!evt.isTemplate) onClickEvent(evt); }}
                      className={`flex h-4 md:h-8 min-w-0 items-center gap-1 md:gap-1.5 rounded-none px-1 md:px-2 text-[7px] md:text-[9px] font-black transition-all group/evt relative shadow-lg
                        ${p ? p.card : "bg-muted text-muted-foreground border border-border"}
                        ${isReview ? "ring-1 ring-foreground/35" : ""}
                        ${evt.isTemplate ? "cursor-default opacity-80" : "cursor-grab active:cursor-grabbing"}
                        ${isDragging ? "opacity-20 scale-90" : "hover:brightness-110"}`}
                    >
                      {p ? <p.Icon className="hidden md:block h-3.5 w-3.5 shrink-0 text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />}
                      <span className="shrink-0 opacity-85 tabular-nums hidden md:inline">{evt.startTime ? fmtHour(evt.startTime, appearance.timeFormat) : "all"}</span>
                      <span className="truncate tracking-tight">{evt.title}</span>
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClickDay(new Date(day)); }}
                    className="h-4 md:h-7 w-full rounded-md bg-muted/60 px-1 md:px-2 text-left text-[8px] md:text-[10px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {t("calendar.moreCount", { count: hiddenCount })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── week view ───────────────────────────────────────────── */

function WeekView({ current, events, onClickEvent }: any) {
  const { appearance } = useUserPreferencesStore();
  const weekDays = getWeekDays(current);
  return (
    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-7 text-center py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-3xl z-10">
        {weekDays.map(d => (
          <div key={d.toISOString()} className={isToday(d) ? "text-primary" : "text-muted-foreground"}>
            <div className="text-[10px] font-black uppercase tracking-widest">{DAYS[d.getDay()]}</div>
            <div className={`mt-1 text-lg font-black ${isToday(d) ? "text-primary" : "text-muted-foreground"}`}>{d.getDate()}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 border-l border-foreground/[0.07] min-h-[600px]">
        {weekDays.map((day, i) => {
          const dayEvts = getEventsForDay(events, day);
          return (
            <div key={i} className="min-h-[140px] p-2 border-r border-b border-foreground/[0.07] hover:bg-foreground/[0.05] transition-colors">
              <div className="space-y-1.5">
                {dayEvts.map((evt: CalEvent) => {
                  const barColor = getBarColor(evt);
                  const p = PLAT[evt.platform];
                  return (
                    <div
                      key={evt.id}
                      onClick={() => { if (!evt.isTemplate) onClickEvent(evt); }}
                      className={`px-2.5 py-2 rounded-xl text-[10px] font-bold transition-all ${evt.isTemplate ? "cursor-default opacity-80" : "cursor-pointer hover:brightness-125"} ${barColor} border border-foreground/10`}
                    >
                      {evt.startTime && <span className="text-foreground/50 mr-1">{fmtHour(evt.startTime, appearance.timeFormat)}</span>}
                      <span className="text-foreground/90">{evt.title}</span>
                      {p && <span className={`block text-[9px] mt-1 px-1.5 py-0.5 rounded w-fit font-black uppercase ${p.badge} ${p.badgeText}`}>{p.label}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── day view ────────────────────────────────────────────── */

function DayView({ current, events, onClickEvent }: any) {
  const { t } = useTranslation();
  const { appearance } = useUserPreferencesStore();
  const dayEvts = getEventsForDay(events, current);
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tighter">{format(current, "EEEE, MMMM do")}</h2>
            <p className="text-muted-foreground text-sm font-medium">{t("calendar.scheduleForDay")}</p>
          </div>
          <span className="text-4xl font-black text-primary/20">{format(current, "dd")}</span>
        </div>
        {dayEvts.length > 0 ? dayEvts.map((evt: CalEvent) => {
          const barColor = getBarColor(evt);
          const p = PLAT[evt.platform];
          return (
            <div
              key={evt.id}
              onClick={() => { if (!evt.isTemplate) onClickEvent(evt); }}
              className={`flex gap-6 p-5 rounded-2xl transition-all border border-foreground/10 ${evt.isTemplate ? "cursor-default opacity-80" : "cursor-pointer hover:brightness-110"} ${barColor}`}
            >
              <div className="w-16 shrink-0 text-sm font-black text-foreground/40 tabular-nums">{evt.startTime ? fmt12(evt.startTime, appearance.timeFormat) : t("calendar.allDay")}</div>
              <div className="flex-1">
                <h3 className="text-base font-black text-foreground tracking-tight">{evt.title}</h3>
                {evt.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{evt.description}</p>}
                {p && <span className={`inline-block text-[9px] mt-3 px-2 py-0.5 rounded font-black uppercase ${p.badge} ${p.badgeText}`}>{p.label}</span>}
              </div>
            </div>
          );
        }) : (
          <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl">
            <p className="text-muted-foreground font-medium">{t("calendar.noEventsDay")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── agenda view ─────────────────────────────────────────── */

function AgendaView({ events, onClickEvent }: any) {
  const { t } = useTranslation();
  const sorted = [...events].sort((a: CalEvent, b: CalEvent) => a.date.localeCompare(b.date));
  const dateGroups = Array.from(new Set(sorted.map(e => e.date)));
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-10">
        {dateGroups.length > 0 ? dateGroups.map(dateStr => {
          const dateObj = parseISO(dateStr);
          const dayEvts = sorted.filter(e => e.date === dateStr);
          return (
            <div key={dateStr} className="grid grid-cols-[56px_1fr] md:grid-cols-[160px_1fr] gap-3 md:gap-6">
              <div className="sticky top-0 h-fit pt-1">
                <div className="text-[9px] md:text-xs font-black text-primary uppercase tracking-widest">{format(dateObj, "MMM")}</div>
                <div className="text-xl md:text-3xl font-black text-foreground">{format(dateObj, "do")}</div>
                <div className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase">{format(dateObj, "EEE")}</div>
              </div>
              <div className="space-y-2 min-w-0">
                {dayEvts.map((evt: CalEvent) => {
                  const barColor = getBarColor(evt);
                  return (
                    <div
                      key={evt.id}
                      onClick={() => { if (!evt.isTemplate) onClickEvent(evt); }}
                      className={`flex items-center gap-2 md:gap-4 p-2.5 md:p-4 rounded-xl border border-foreground/5 transition-all ${evt.isTemplate ? "cursor-default opacity-80" : "cursor-pointer hover:brightness-110"} ${barColor}`}
                    >
                      <div className="w-10 md:w-14 shrink-0 text-[10px] md:text-xs font-bold text-foreground/40 tabular-nums">{evt.startTime || "00:00"}</div>
                      <div className="flex-1 min-w-0 font-bold text-foreground truncate text-sm md:text-base">{evt.title}</div>
                      {evt.platform && evt.platform !== "none" && PLAT[evt.platform] && (
                        <span className={`shrink-0 text-[8px] md:text-[9px] font-black uppercase px-1.5 md:px-2 py-0.5 rounded ${PLAT[evt.platform].badge} ${PLAT[evt.platform].badgeText}`}>
                          {PLAT[evt.platform].label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">{t("calendar.nothingOnAgenda")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── event modal ─────────────────────────────────────────── */

const SELECT_CLS = "w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors appearance-none cursor-pointer";
const INPUT_CLS  = "w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60 transition-colors";
const LABEL_CLS  = "block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5";

function EventModal({ event, defaultDate, onSave, onDelete, onApprove, onClose }: any) {
  const { t } = useTranslation();
  const [title,       setTitle]       = useState(event?.title       || "");
  const [date,        setDate]        = useState(event?.date        || (defaultDate ? fmtKey(defaultDate) : fmtKey(new Date())));
  const [startTime,   setStartTime]   = useState(event?.startTime   || "09:00");
  const [category,    setCategory]    = useState(event?.category    || "content");
  const [platform,    setPlatform]    = useState(event?.platform    || "none");
  const [description, setDescription] = useState(event?.description || "");
  const [imageUrl,    setImageUrl]    = useState(event?.imageUrl    || "");
  const [contentType, setContentType] = useState(event?.contentType || "post");
  const [status,      setStatus]      = useState(event?.status      || "draft");
  const [hashtags,    setHashtags]    = useState(event?.hashtags    || "");
  const [caption,     setCaption]     = useState(event?.caption     || "");

  const isEditing = !!event;

  const limit = getPlatformLimit(platform);
  const captionLen = caption.length;
  const captionMax = limit?.caption ?? 0;
  const captionOver = limit ? captionLen > captionMax : false;
  const captionPct = limit ? Math.min(100, (captionLen / captionMax) * 100) : 0;

  const hashtagCount = hashtags.split(/\s+/).filter((t: string) => t.startsWith("#")).length;
  const hashtagMax = limit?.hashtags;
  const hashtagOver = hashtagMax ? hashtagCount > hashtagMax : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground tracking-tight">
                {isEditing ? t("calendar.editContent") : t("calendar.scheduleContent")}
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium">
                {isEditing ? t("calendar.updateScheduledContent") : t("calendar.planNewContent")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-lg">✕</button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Title */}
          <div>
            <label className={LABEL_CLS}>{t("calendar.contentTitle")}</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t("calendar.contentTitlePlaceholder")}
              className={INPUT_CLS}
            />
          </div>

          {/* Caption / Main body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={LABEL_CLS}>{t("calendar.captionLabel")}</label>
              {limit && (
                <span className={`text-[10px] font-mono font-bold tabular-nums ${captionOver ? "text-destructive" : captionPct > 85 ? "text-warn" : "text-muted-foreground"}`}>
                  {t("calendar.charsOf", { current: captionLen.toLocaleString(), max: captionMax.toLocaleString(), platform: limit.label })}
                </span>
              )}
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={4}
              placeholder={t("calendar.captionPlaceholder")}
              className={`${INPUT_CLS} resize-none leading-relaxed ${captionOver ? "border-destructive focus:border-destructive" : ""}`}
            />
            {limit && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full transition-all ${captionOver ? "bg-destructive" : captionPct > 85 ? "bg-warn" : "bg-primary"}`}
                  style={{ width: `${captionPct}%` }}
                />
              </div>
            )}
            {captionOver && (
              <p className="mt-1 text-[10px] text-destructive font-bold">
                {t("calendar.exceedsLimit", { platform: limit?.label, count: (captionLen - captionMax).toLocaleString() })}
              </p>
            )}
          </div>

          {/* Hashtags */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={LABEL_CLS}>{t("calendar.hashtagsLabel")}</label>
              {hashtagMax && (
                <span className={`text-[10px] font-mono font-bold tabular-nums ${hashtagOver ? "text-destructive" : "text-muted-foreground"}`}>
                  {t("calendar.tagsOf", { current: hashtagCount, max: hashtagMax })}
                </span>
              )}
            </div>
            <input
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder={t("calendar.hashtagsPlaceholder")}
              className={`${INPUT_CLS} ${hashtagOver ? "border-destructive focus:border-destructive" : ""}`}
            />
          </div>

          {/* Row: Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS} htmlFor="modal-date">{t("calendar.scheduledDate")}</label>
              <input id="modal-date" type="date" title={t("calendar.scheduledDate")} aria-label={t("calendar.scheduledDate")} value={date} onChange={e => setDate(e.target.value)}
                className={`${INPUT_CLS} input-dark-scheme`} />
            </div>
            <div>
              <label className={LABEL_CLS} htmlFor="modal-time">{t("calendar.scheduledTime")}</label>
              <input id="modal-time" type="time" title={t("calendar.scheduledTime")} aria-label={t("calendar.scheduledTime")} value={startTime} onChange={e => setStartTime(e.target.value)}
                className={`${INPUT_CLS} input-dark-scheme`} />
            </div>
          </div>

          {/* Row: Platform + Content Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className={LABEL_CLS} htmlFor="modal-platform">{t("calendar.platform")}</label>
              <select id="modal-platform" title={t("calendar.platform")} aria-label={t("calendar.platform")} value={platform} onChange={e => setPlatform(e.target.value)} className={`${SELECT_CLS} select-no-arrow`}>
                <option value="none">{t("calendar.noPlatform")}</option>
                {Object.keys(PLAT).map(k => (
                  <option key={k} value={k}>{PLAT[k].label}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className={LABEL_CLS} htmlFor="modal-content-type">{t("calendar.contentType")}</label>
              <select id="modal-content-type" title={t("calendar.contentType")} aria-label={t("calendar.contentType")} value={contentType} onChange={e => setContentType(e.target.value)} className={`${SELECT_CLS} select-no-arrow`}>
                {[["post",t("calendar.typeFeedPost")],["reel",t("calendar.typeReel")],["story",t("calendar.typeStory")],["article",t("calendar.typeArticle")],["video",t("calendar.typeVideo")],["podcast",t("calendar.typePodcast")],["newsletter",t("calendar.typeNewsletter")],["thread",t("calendar.typeThread")]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Category + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className={LABEL_CLS} htmlFor="modal-category">{t("calendar.category")}</label>
              <select id="modal-category" title={t("calendar.category")} aria-label={t("calendar.category")} value={category} onChange={e => setCategory(e.target.value)} className={`${SELECT_CLS} select-no-arrow`}>
                {[["content",t("calendar.catContent")],["publish",t("calendar.catPublish")],["meeting",t("calendar.catMeetings")],["deadline",t("calendar.catDeadlines")],["research",t("calendar.catResearch")],["personal",t("calendar.catPersonal")]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className={LABEL_CLS} htmlFor="modal-status">{t("calendar.publishStatus")}</label>
              <select id="modal-status" title={t("calendar.publishStatus")} aria-label={t("calendar.publishStatus")} value={status} onChange={e => setStatus(e.target.value)} className={`${SELECT_CLS} select-no-arrow`}>
                {[["draft",t("calendar.statusDraft")],["scheduled",t("calendar.statusScheduled")],["published",t("calendar.statusPublished")],["awaiting_review",t("calendar.statusAwaitingReview")]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL_CLS}>{t("calendar.internalNotes")}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder={t("calendar.internalNotesPlaceholder")}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {/* Media */}
          <div>
            <label className={LABEL_CLS}>{t("calendar.mediaLabel")}</label>
            {!imageUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-24 bg-muted/20 border-2 border-dashed border-border hover:border-primary/40 rounded-xl cursor-pointer hover:bg-muted/30 transition-all group">
                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📷</span>
                <span className="text-[11px] font-bold text-muted-foreground">{t("calendar.clickToAttach")}</span>
                <span className="text-[10px] text-muted-foreground/50">{t("calendar.imageFormats")}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setImageUrl(URL.createObjectURL(f));
                }} />
              </label>
            ) : (
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border group">
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={() => setImageUrl("")}
                    className="px-3 py-1.5 bg-destructive text-destructive-foreground text-xs font-black rounded-lg">
                    {t("calendar.remove")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Needs approval banner */}
          {event?.status === "awaiting_review" && (
            <div className="p-4 rounded-xl bg-warn/10 border border-warn/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-warn">{t("calendar.needsApproval")}</p>
                  <p className="text-[10px] text-warn/60">{t("calendar.aiAwaitingReview")}</p>
                </div>
              </div>
              <button
                onClick={() => { if (onApprove) onApprove(event.id); onClose(); }}
                className="px-4 py-2 bg-warn hover:brightness-110 text-warn-foreground text-xs font-black rounded-xl transition-colors"
              >
                🚀 {t("calendar.approve")}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <div>
            {isEditing && onDelete && (
              <button
                onClick={() => { onDelete(event.originalId || event.id); onClose(); }}
                className="px-4 py-2 text-xs font-black text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
              >
                {t("calendar.delete")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-black text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
              {t("calendar.cancel")}
            </button>
            <button
              onClick={() => {
                onSave({
                  id: event?.id || `evt-${Date.now()}`,
                  title, date, startTime, category, platform,
                  description, imageUrl, status, contentType,
                  hashtags, caption,
                });
                onClose();
              }}
              disabled={!title.trim()}
              className="px-6 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground text-xs font-black rounded-xl transition-all"
            >
              {isEditing ? t("calendar.saveChanges") : t("calendar.scheduleContent")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── main calendar ───────────────────────────────────────── */

export default function ContentCalendar() {
  const { t } = useTranslation();
  const { posts, addPost, updatePost, deletePost, schedulePost } = usePosts();
  const { processUJT } = useUJT();
  const isMobile = useIsMobile();

  const [current, setCurrent] = useState(new Date());
  const [miniMonth, setMiniMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);

  // The sidebar used to render inline (a fixed 340px column) no matter the
  // viewport, and the month grid ("month" is also a bad default on a phone
  // - 7 dense columns don't fit) rendered unconditionally too. On a ~390px
  // screen that squeezed the main grid to nothing and, combined with the
  // sidebar's semi-transparent background, showed as overlapping unreadable
  // text rather than a real layout. Runs once when mobile is first
  // detected (post-mount - matchMedia isn't available during render) and
  // doesn't fight the user if they then open the sidebar or switch views
  // themselves.
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setViewMode("agenda");
    }
  }, [isMobile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { const json = JSON.parse(ev.target?.result as string); if (json.version === "1.0") processUJT(json); } catch { /* ignore invalid/unrecognized file */ }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Map DB posts → calendar events
  const postEvents: CalEvent[] = posts.map((post: any) => {
    const { date, startTime } = splitScheduledAt(post.scheduledAt);
    const platform = post.platforms?.[0]?.platform?.toLowerCase() || "none";
    const websiteCategory = platform === "website" && post.scheduledAt ? getWebsiteCategoryForDate(parseISO(post.scheduledAt)) : null;
    return {
      id: post.id,
      originalId: post.id,
      title: websiteCategory ? `${websiteCategory.category}: ${post.title}` : post.title,
      description: websiteCategory ? websiteCategory.focus : post.excerpt || "",
      caption: post.content || "",
      date,
      startTime,
      category: (post.category?.toLowerCase() || (post.status === "scheduled" ? "content" : post.status === "published" ? "publish" : post.status === "awaiting_review" ? "awaiting_review" : "content")),
      status: post.status,
      platform,
      completed: post.status === "published",
      allDay: !post.scheduledAt,
      imageUrl: post.cover_image_url || "",
    };
  });

  const events: CalEvent[] = postEvents;

  const navigate = useCallback((dir: number) => {
    const next = new Date(current);
    if (viewMode === "month") next.setMonth(current.getMonth() + dir);
    else if (viewMode === "week") next.setDate(current.getDate() + dir * 7);
    else if (viewMode === "day") next.setDate(current.getDate() + dir);
    setCurrent(next);
  }, [current, viewMode]);

  const handleSaveEvent = (event: any) => {
    const scheduledAt = event.startTime ? `${event.date}T${event.startTime}:00` : `${event.date}T09:00:00`;
    const isUpdating = !event.id.startsWith("evt-");
    if (isUpdating) {
      updatePost.mutate({ 
        id: event.id, 
        title: event.title, 
        content: event.caption, 
        excerpt: event.description,
        status: event.status || "scheduled", 
        type: event.contentType || "text" 
      });
      if (event.status !== "awaiting_review") schedulePost.mutate({ id: event.id, scheduledAt });
    } else {
      addPost.mutate({ 
        post: { 
          title: event.title, 
          content: event.caption || "", 
          excerpt: event.description || "",
          type: event.contentType || "text", 
          status: "scheduled", 
          scheduled_at: scheduledAt,
          cover_image_url: event.imageUrl || ""
        }, 
        platforms: [event.platform] 
      });
    }
  };
  const handleDeleteEvent = (id: string) => deletePost.mutate(id);
  const handleApproveEvent = (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) schedulePost.mutate({ id, scheduledAt: event.startTime ? `${event.date}T${event.startTime}:00` : `${event.date}T09:00:00` });
  };

  // Drag-and-drop reschedule: keep original time-of-day, change date only
  const handleDropReschedule = useCallback((postId: string, newDay: Date) => {
    const evt = events.find(e => (e.originalId || e.id) === postId);
    if (!evt || evt.date === fmtKey(newDay)) return;
    const time = evt.startTime || "09:00";
    schedulePost.mutate({ id: postId, scheduledAt: `${fmtKey(newDay)}T${time}:00` });
  }, [events, schedulePost]);

  const filtered = searchQuery.trim()
    ? events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : categoryFilter === "all" ? events : events.filter(e => e.category === categoryFilter || e.status === categoryFilter);

  const todayCount = events.filter(e => e.date === fmtKey(new Date())).length;
  const publishCount = events.filter(e => e.category === "publish").length;
  const deadlineCount = events.filter(e => e.category === "deadline").length;

  const headerLabel = (() => {
    if (viewMode === "month") return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`;
    if (viewMode === "week") {
      const start = new Date(current); start.setDate(current.getDate() - current.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return start.getMonth() === end.getMonth()
        ? `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`
        : `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
    }
    if (viewMode === "day") return current.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return `${t("calendar.agendaPrefix")} · ${MONTHS[current.getMonth()]} ${current.getFullYear()}`;
  })();

  return (
    <DashboardLayout>
      <DragDropImport onImport={(data) => { if (data.version === "1.0") processUJT(data); }} entityName="UJT">
        <div className="flex h-[calc(100vh-8rem)] w-full bg-background text-foreground overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">

          {/* Page title */}
          <div className="flex items-center justify-between px-4 md:px-6 pt-2 pb-4 gap-2">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(p => !p)}
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-foreground/[0.07] border border-foreground/[0.16] hover:bg-foreground/[0.12] text-muted-foreground transition-all"
                aria-label={t("calendar.toggleSidebar")}
              >
                {sidebarOpen && !isMobile ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <h1 className="page-title mb-0 truncate">{t("calendar.title")}</h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 w-3.5 h-3.5" />
                <input
                  aria-label={t("common.search")}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t("calendar.searchPlaceholder")}
                  className="w-32 md:w-64 bg-foreground/[0.05] border border-foreground/[0.10] rounded-xl pl-10 pr-4 py-2 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-all"
                />
              </div>
              <div className="hidden lg:flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-success/10 border border-success/20 text-[9px] font-black text-success uppercase tracking-widest"><CalendarDays className="w-3 h-3" /> {todayCount}</span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest"><Send className="w-3 h-3" /> {publishCount}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar — an overlay Sheet on mobile (its own portal/backdrop,
                doesn't share layout flow with the main grid), an inline
                pushed column on desktop. Rendering the fixed 340px column
                inline regardless of viewport used to be what broke mobile:
                it left no room for the main grid and, combined with the
                sidebar's semi-transparent background, showed as overlapping
                unreadable text instead of a real layout. */}
            {isMobile ? (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="w-[85vw] max-w-[340px] p-8 bg-background border-foreground/[0.10] overflow-y-auto custom-scrollbar">
                  <CalSidebar
                    events={filtered}
                    miniMonth={miniMonth}
                    selectedDate={selectedDate}
                    onSelectDate={(d: Date) => { setSelectedDate(d); setCurrent(d); setSidebarOpen(false); }}
                    onNavMonth={(dir: number) => { const n = new Date(miniMonth); n.setMonth(miniMonth.getMonth() + dir); setMiniMonth(n); }}
                    onAddEvent={() => { setEditingEvent(null); setDefaultDate(undefined); setModalOpen(true); }}
                    onClickEvent={(evt: CalEvent) => { setEditingEvent(evt); setModalOpen(true); setSidebarOpen(false); }}
                    filter={categoryFilter}
                    onFilter={setCategoryFilter}
                  />
                </SheetContent>
              </Sheet>
            ) : sidebarOpen && (
              <div className="w-[340px] bg-background/20 backdrop-blur-2xl border-r border-foreground/[0.10] pl-4 pr-8 py-8 shrink-0 overflow-y-auto custom-scrollbar relative z-10">
                <CalSidebar
                  events={filtered}
                  miniMonth={miniMonth}
                  selectedDate={selectedDate}
                  onSelectDate={(d: Date) => { setSelectedDate(d); setCurrent(d); }}
                  onNavMonth={(dir: number) => { const n = new Date(miniMonth); n.setMonth(miniMonth.getMonth() + dir); setMiniMonth(n); }}
                  onAddEvent={() => { setEditingEvent(null); setDefaultDate(undefined); setModalOpen(true); }}
                  onClickEvent={(evt: CalEvent) => { setEditingEvent(evt); setModalOpen(true); }}
                  filter={categoryFilter}
                  onFilter={setCategoryFilter}
                />
              </div>
            )}

            {/* Main grid area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Toolbar */}
              <div className="flex-shrink-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 md:px-8 py-3 md:py-4 border-b border-foreground/[0.10] bg-background/20 backdrop-blur-xl">
                <div className="flex items-center gap-3 md:gap-5 min-w-0">
                  <div className="flex bg-foreground/[0.07] rounded-2xl p-1.5 border border-foreground/[0.16] backdrop-blur-md shrink-0">
                    <button onClick={() => navigate(-1)} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-all group">
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <button
                      onClick={() => { setCurrent(new Date()); setSelectedDate(new Date()); }}
                      className={`px-3 md:px-6 py-1 rounded-xl text-[10px] font-black tracking-[0.1em] uppercase transition-all ${isToday(current) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {t("calendar.today")}
                    </button>
                    <button onClick={() => navigate(1)} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-all group">
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                  <h2 className="text-sm md:text-lg font-black text-foreground tracking-tight truncate">{headerLabel}</h2>
                </div>

                <div className="flex items-center gap-2 md:gap-4 overflow-x-auto custom-scrollbar -mx-1 px-1 md:mx-0 md:px-0 md:overflow-visible">
                  <div className="flex bg-foreground/[0.07] border border-foreground/[0.16] rounded-2xl p-1.5 backdrop-blur-md shrink-0">
                    {(["month", "week", "day", "agenda"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setViewMode(m)}
                        className={`px-3 md:px-6 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === m ? "bg-foreground/10 text-foreground shadow-xl shadow-foreground/5" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]"}`}
                      >
                        {t(`calendar.view${m.charAt(0).toUpperCase()}${m.slice(1)}`)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setEditingEvent(null); setDefaultDate(undefined); setModalOpen(true); }}
                    title={t("calendar.addNewEvent")}
                    aria-label={t("calendar.addNewEvent")}
                    className="w-9 h-9 md:w-11 md:h-11 shrink-0 flex items-center justify-center rounded-[1.25rem] bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-2xl shadow-primary/40 active:scale-95 group"
                  >
                    <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                </div>
              </div>

              {/* View */}
              <div className="flex-1 overflow-hidden flex flex-col bg-background">
                {viewMode === "month" && <MonthGrid current={current} events={filtered} categoryFilter={categoryFilter} onClickDay={(d: Date) => { setSelectedDate(d); setDefaultDate(d); setEditingEvent(null); setModalOpen(true); }} onClickEvent={(evt: CalEvent) => { setEditingEvent(evt); setModalOpen(true); }} onDropEvent={handleDropReschedule} />}
                {viewMode === "week" && <WeekView current={current} events={filtered} onClickEvent={(evt: CalEvent) => { setEditingEvent(evt); setModalOpen(true); }} />}
                {viewMode === "day" && <DayView current={current} events={filtered} onClickEvent={(evt: CalEvent) => { setEditingEvent(evt); setModalOpen(true); }} />}
                {viewMode === "agenda" && <AgendaView events={filtered} onClickEvent={(evt: CalEvent) => { setEditingEvent(evt); setModalOpen(true); }} />}
              </div>
            </div>
          </div>
        </div>

        {modalOpen && (
            <EventModal
              event={editingEvent}
              defaultDate={defaultDate}
              onSave={handleSaveEvent}
              onDelete={handleDeleteEvent}
              onApprove={handleApproveEvent}
              onClose={() => { setModalOpen(false); setEditingEvent(null); }}
            />
          )}
        </div>
      </DragDropImport>
    </DashboardLayout>
  );
}

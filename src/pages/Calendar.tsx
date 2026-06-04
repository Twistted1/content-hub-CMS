import React, { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePosts } from "@/hooks/usePosts";
import { useUJT } from "@/hooks/useUJT";
import { DragDropImport } from "@/components/common/DragDropImport";
import { parseISO, format } from "date-fns";
import { NotificationsDropdown } from "@/components/header/NotificationsDropdown";
import { UserDropdown } from "@/components/header/UserDropdown";
import {
  ChevronLeft, ChevronRight, Plus, Search, Bell, CalendarDays, Send, AlarmClock,
  Clapperboard, Briefcase, Users as UsersIcon, Sprout, Diamond, Youtube, Music2, Twitter, Instagram, Facebook, Linkedin, Globe, Video,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
function fmt12(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }
function fmtHour(t: string) { const h = parseInt(t.split(":")[0]); return `${h % 12 || 12} ${h >= 12 ? "pm" : "am"}`; }

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const DAYS_SHORT = ["S","M","T","W","T","F","S"];

/* ── category / platform config ─────────────────────────── */

type CatKey = "content" | "publish" | "meeting" | "deadline" | "personal" | "awaiting_review";

const CAT: Record<CatKey, { color: string; bg: string; border: string; label: string; Icon: any; iconBg: string; iconColor: string }> = {
  content:  { color: "text-primary",      bg: "bg-primary/10",    border: "border-primary/20",   label: "Content",   Icon: Clapperboard, iconBg: "bg-primary/10",    iconColor: "text-primary" },
  publish:  { color: "text-amber-300",   bg: "bg-amber-500/10",  border: "border-amber-500/20", label: "Publish",   Icon: Briefcase,    iconBg: "bg-amber-500/10",   iconColor: "text-amber-400" },
  meeting:  { color: "text-blue-300",    bg: "bg-blue-500/10",   border: "border-blue-500/20",  label: "Meetings",  Icon: UsersIcon,    iconBg: "bg-blue-500/10",    iconColor: "text-blue-400" },
  deadline: { color: "text-red-300",     bg: "bg-red-500/10",    border: "border-red-500/20",   label: "Deadlines", Icon: AlarmClock,   iconBg: "bg-red-500/10",     iconColor: "text-red-400" },
  personal: { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Personal", Icon: Sprout,      iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400" },
  awaiting_review: { color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Needs Review", Icon: AlarmClock, iconBg: "bg-orange-500/10", iconColor: "text-orange-400" },
};

const PLAT: Record<string, { bar: string; badge: string; badgeText: string; label: string; Icon: any }> = {
  youtube:   { bar: "bg-red-600/10 border-red-600/20",     badge: "bg-red-600 shadow-lg shadow-red-600/20",    badgeText: "text-white", label: "YouTube",   Icon: Youtube },
  tiktok:    { bar: "bg-zinc-600/10 border-zinc-600/20",    badge: "bg-black shadow-lg shadow-white/10",      badgeText: "text-white", label: "TikTok",    Icon: Music2 },
  instagram: { bar: "bg-pink-600/10 border-pink-600/20",    badge: "bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-pink-500/20", badgeText: "text-white", label: "Instagram", Icon: Instagram },
  twitter:   { bar: "bg-sky-600/10 border-sky-600/20",     badge: "bg-sky-500 shadow-lg shadow-sky-500/20",    badgeText: "text-white", label: "Twitter/X", Icon: Twitter },
  facebook:  { bar: "bg-blue-700/10 border-blue-700/20",    badge: "bg-blue-600 shadow-lg shadow-blue-600/20",   badgeText: "text-white", label: "Facebook",  Icon: Facebook },
  linkedin:  { bar: "bg-blue-800/10 border-blue-800/20",    badge: "bg-blue-700 shadow-lg shadow-blue-700/20",   badgeText: "text-white", label: "LinkedIn",  Icon: Linkedin },
  website:   { bar: "bg-emerald-600/10 border-emerald-600/20", badge: "bg-emerald-600 shadow-lg shadow-emerald-600/20",badgeText: "text-white", label: "Website",   Icon: Globe },
  rumble:    { bar: "bg-green-600/10 border-green-600/20",   badge: "bg-green-500 shadow-lg shadow-green-600/20",  badgeText: "text-white", label: "Rumble",    Icon: Video },
};

function getBarColor(evt: CalEvent) {
  if (evt.platform && evt.platform !== "none" && PLAT[evt.platform]) return PLAT[evt.platform].bar;
  const c = CAT[evt.category as CatKey];
  return c ? c.bg : "bg-violet-500/20";
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
}

function getEventsForDay(events: CalEvent[], day: Date) {
  return events.filter(e => e.date === fmtKey(day)).sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });
}

/* ── filters ─────────────────────────────────────────────── */

const FILTERS: { value: string; label: string; cat?: CatKey }[] = [
  { value: "all",      label: "All" },
  { value: "content",  label: "Content",   cat: "content" },
  { value: "publish",  label: "Publish",   cat: "publish" },
  { value: "meeting",  label: "Meetings",  cat: "meeting" },
  { value: "deadline", label: "Deadlines", cat: "deadline" },
  { value: "personal", label: "Personal",  cat: "personal" },
];

/* ── mini calendar ───────────────────────────────────────── */

function MiniCal({ current, selected, events, onSelect, onNav }: { current: Date; selected: Date; events: CalEvent[]; onSelect: (d: Date) => void; onNav: (dir: number) => void }) {
  const days = getDaysInMonth(current.getFullYear(), current.getMonth());
  return (
    <div className="glass-card rounded-2xl p-3 mb-4 mx-auto w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => onNav(-1)} aria-label="Previous Month" className="w-6 h-6 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 flex items-center justify-center transition-all text-sm">‹</button>
        <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase">{MONTHS[current.getMonth()].slice(0,3)} {current.getFullYear()}</span>
        <button onClick={() => onNav(1)} aria-label="Next Month" className="w-6 h-6 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 flex items-center justify-center transition-all text-sm">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d, i) => <div key={i} className="text-center text-[9px] text-muted-foreground font-black py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          const sel = isSame(day, selected);
          const today = isToday(day);
          const hasEvt = events.some(e => e.date === fmtKey(day));
          const inMonth = day.getMonth() === current.getMonth();
          return (
            <button
              key={i}
              onClick={() => onSelect(new Date(day))}
              className={`relative flex items-center justify-center w-6 h-6 mx-auto rounded-lg text-[10px] font-bold transition-all
                ${today ? "bg-primary text-white shadow-lg shadow-primary/30" : sel ? "bg-white/20 text-white" : inMonth ? "text-muted-foreground hover:bg-white/5 hover:text-white" : "text-white/10"}`}
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
  const todayEvents = getEventsForDay(events, new Date());
  const done = todayEvents.filter((e: CalEvent) => e.completed).length;

  return (
    <aside className="flex flex-col gap-5 overflow-y-auto pb-6 h-full pr-1 custom-scrollbar">
      <MiniCal current={miniMonth} selected={selectedDate} events={events} onSelect={onSelectDate} onNav={onNavMonth} />

      {/* Filter by type */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-4 px-1">Filter Stream</h3>
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
                  ${active ? "bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5" : "text-muted-foreground hover:bg-white/[0.03] hover:text-white"}`}
              >
                <span className="flex items-center gap-3">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${cat ? cat.iconBg : "bg-white/[0.05]"} ${active ? "scale-110" : "group-hover:scale-105"}`}>
                    {cat ? <cat.Icon className={`w-4 h-4 ${cat.iconColor}`} /> : <Diamond className="w-4 h-4 text-primary" />}
                  </span>
                  {f.label}
                </span>
                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black transition-all ${active ? "bg-primary/20 text-primary" : "bg-white/[0.05] text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's agenda */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em]">Live Queue</h3>
          <span className="text-[10px] text-muted-foreground font-bold">{done}/{todayEvents.length} READY</span>
        </div>
        {todayEvents.length > 0 && (
          <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${todayEvents.length > 0 ? (done / todayEvents.length) * 100 : 0}%` }}
            />
          </div>
        )}
        <div className="space-y-3">
          {todayEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Sprout className="w-10 h-10 text-white/[0.05] mb-3" />
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40 italic">Nothing queued</p>
            </div>
          )}
          {todayEvents.map((evt: CalEvent) => {
            const p = PLAT[evt.platform];
            const cat = CAT[evt.category as CatKey] || CAT.content;
            return (
              <div
                key={evt.id}
                onClick={() => onClickEvent(evt)}
                className={`relative rounded-2xl overflow-hidden cursor-pointer group transition-all hover:translate-x-1 glass-hover border border-white/[0.05] ${cat.bg.replace('/10', '/5')}`}
              >
                <div className="px-4 py-3.5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${evt.completed ? "bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "border-white/20"}`} />
                    <p className={`text-xs font-bold truncate tracking-tight ${evt.completed ? "line-through text-muted-foreground/60" : "text-white"}`}>{evt.title}</p>
                  </div>
                  <div className="flex items-center justify-between ml-7">
                    {evt.startTime && (
                      <p className="text-[10px] text-muted-foreground font-black">
                        {fmt12(evt.startTime)}
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
  const days = getDaysInMonth(current.getFullYear(), current.getMonth());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-white/[0.01] rounded-[2.5rem] border border-white/[0.05] overflow-hidden">
      <div className="grid grid-cols-7 text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] py-5 border-b border-white/[0.05] sticky top-0 bg-background/80 backdrop-blur-3xl z-10">
        {DAYS.map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="flex-1 grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvts = getEventsForDay(events, day).filter((e: CalEvent) => categoryFilter === "all" || e.category === categoryFilter);
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
              className={`min-h-[160px] p-4 border-r border-b border-white/[0.03] cursor-pointer transition-all group relative
                ${!inMonth ? "opacity-10 pointer-events-none" : ""}
                ${isDropTarget ? "bg-primary/10 ring-2 ring-inset ring-primary/40 shadow-[inset_0_0_50px_rgba(var(--primary),0.1)]" : today ? "bg-primary/[0.02]" : "hover:bg-white/[0.015]"}`}
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black transition-all
                  ${today ? "bg-primary text-white shadow-xl shadow-primary/40 scale-110" : inMonth ? "text-muted-foreground group-hover:text-white group-hover:scale-105" : "text-white/5"}`}>
                  {day.getDate()}
                </span>
                {dayEvts.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />}
              </div>
              <div className="space-y-1.5">
                {dayEvts.slice(0, 4).map((evt: CalEvent) => {
                  const p = PLAT[evt.platform];
                  const isReview = evt.status === "awaiting_review";
                  const isDragging = draggingId === evt.id;
                  return (
                    <div
                      key={evt.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData("text/event-id", evt.originalId || evt.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(evt.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverKey(null); }}
                      onClick={(e) => { e.stopPropagation(); onClickEvent(evt); }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[10px] font-black truncate cursor-grab active:cursor-grabbing transition-all hover:scale-[1.03] group/evt relative
                        ${p ? p.bar : "bg-white/[0.05] border border-white/[0.05]"} 
                        ${isReview ? "animate-pulse ring-1 ring-orange-500/40" : ""} 
                        ${isDragging ? "opacity-20 scale-90" : "hover:brightness-125 shadow-sm"}`}
                    >
                      {p ? <p.Icon className="w-3 h-3 text-white/80 shrink-0" /> : <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />}
                      <span className="text-white/90 truncate tracking-tight">{evt.title}</span>
                    </div>
                  );
                })}
                {dayEvts.length > 4 && (
                  <div className="text-[9px] text-muted-foreground font-black px-2 pt-1 uppercase tracking-widest opacity-60">
                    + {dayEvts.length - 4} More
                  </div>
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
  const weekDays = getWeekDays(current);
  return (
    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-7 text-center py-3 border-b border-white/5 sticky top-0 bg-[#0a0d1a] z-10">
        {weekDays.map(d => (
          <div key={d.toISOString()} className={isToday(d) ? "text-primary" : "text-gray-500"}>
            <div className="text-[10px] font-black uppercase tracking-widest">{DAYS[d.getDay()]}</div>
            <div className={`mt-1 text-lg font-black ${isToday(d) ? "text-primary" : "text-gray-300"}`}>{d.getDate()}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 border-l border-white/[0.03] min-h-[600px]">
        {weekDays.map((day, i) => {
          const dayEvts = getEventsForDay(events, day);
          return (
            <div key={i} className="min-h-[140px] p-2 border-r border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <div className="space-y-1.5">
                {dayEvts.map((evt: CalEvent) => {
                  const barColor = getBarColor(evt);
                  const p = PLAT[evt.platform];
                  return (
                    <div
                      key={evt.id}
                      onClick={() => onClickEvent(evt)}
                      className={`px-2.5 py-2 rounded-xl text-[10px] font-bold cursor-pointer hover:brightness-125 transition-all ${barColor} border border-white/10`}
                    >
                      {evt.startTime && <span className="text-white/50 mr-1">{fmtHour(evt.startTime)}</span>}
                      <span className="text-white/90">{evt.title}</span>
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
  const dayEvts = getEventsForDay(events, current);
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter">{format(current, "EEEE, MMMM do")}</h2>
            <p className="text-gray-500 text-sm font-medium">Schedule for the day</p>
          </div>
          <span className="text-4xl font-black text-primary/20">{format(current, "dd")}</span>
        </div>
        {dayEvts.length > 0 ? dayEvts.map((evt: CalEvent) => {
          const barColor = getBarColor(evt);
          const p = PLAT[evt.platform];
          return (
            <div
              key={evt.id}
              onClick={() => onClickEvent(evt)}
              className={`flex gap-6 p-5 rounded-2xl cursor-pointer hover:brightness-110 transition-all border border-white/10 ${barColor}`}
            >
              <div className="w-16 shrink-0 text-sm font-black text-white/40 tabular-nums">{evt.startTime ? fmt12(evt.startTime) : "All Day"}</div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white tracking-tight">{evt.title}</h3>
                {evt.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{evt.description}</p>}
                {p && <span className={`inline-block text-[9px] mt-3 px-2 py-0.5 rounded font-black uppercase ${p.badge} ${p.badgeText}`}>{p.label}</span>}
              </div>
            </div>
          );
        }) : (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <p className="text-gray-600 font-medium">No events for this day</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── agenda view ─────────────────────────────────────────── */

function AgendaView({ events, onClickEvent }: any) {
  const sorted = [...events].sort((a: CalEvent, b: CalEvent) => a.date.localeCompare(b.date));
  const dateGroups = Array.from(new Set(sorted.map(e => e.date)));
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {dateGroups.length > 0 ? dateGroups.map(dateStr => {
          const dateObj = parseISO(dateStr);
          const dayEvts = sorted.filter(e => e.date === dateStr);
          return (
            <div key={dateStr} className="grid grid-cols-[160px_1fr] gap-6">
              <div className="sticky top-0 h-fit pt-1">
                <div className="text-xs font-black text-primary uppercase tracking-widest">{format(dateObj, "MMMM")}</div>
                <div className="text-3xl font-black text-white">{format(dateObj, "do")}</div>
                <div className="text-[10px] font-bold text-gray-600 uppercase">{format(dateObj, "EEEE")}</div>
              </div>
              <div className="space-y-2">
                {dayEvts.map((evt: CalEvent) => {
                  const barColor = getBarColor(evt);
                  return (
                    <div
                      key={evt.id}
                      onClick={() => onClickEvent(evt)}
                      className={`flex items-center gap-4 p-4 rounded-xl border border-white/5 cursor-pointer hover:brightness-110 transition-all ${barColor}`}
                    >
                      <div className="w-14 text-xs font-bold text-white/40 tabular-nums">{evt.startTime || "00:00"}</div>
                      <div className="flex-1 font-bold text-white truncate">{evt.title}</div>
                      {evt.platform && evt.platform !== "none" && PLAT[evt.platform] && (
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${PLAT[evt.platform].badge} ${PLAT[evt.platform].badgeText}`}>
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
          <div className="flex flex-col items-center justify-center py-20 text-gray-600">
            <p className="text-lg font-medium">Nothing on your agenda</p>
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
                {isEditing ? "Edit Content" : "Schedule Content"}
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium">
                {isEditing ? "Update your scheduled content" : "Plan and schedule a new piece of content"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-lg">✕</button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Title */}
          <div>
            <label className={LABEL_CLS}>Content Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 5 tips for growing on Instagram in 2025…"
              className={INPUT_CLS}
            />
          </div>

          {/* Caption / Main body */}
          <div>
            <label className={LABEL_CLS}>Caption / Content Body</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={4}
              placeholder="Write your post caption, article intro, or video script hook here…"
              className={`${INPUT_CLS} resize-none leading-relaxed`}
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className={LABEL_CLS}>Hashtags</label>
            <input
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#contentmarketing #socialmedia #growthhacking"
              className={INPUT_CLS}
            />
          </div>

          {/* Row: Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS} htmlFor="modal-date">Scheduled Date</label>
              <input id="modal-date" type="date" title="Scheduled Date" aria-label="Scheduled Date" value={date} onChange={e => setDate(e.target.value)}
                className={`${INPUT_CLS} input-dark-scheme`} />
            </div>
            <div>
              <label className={LABEL_CLS} htmlFor="modal-time">Scheduled Time</label>
              <input id="modal-time" type="time" title="Scheduled Time" aria-label="Scheduled Time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className={`${INPUT_CLS} input-dark-scheme`} />
            </div>
          </div>

          {/* Row: Platform + Content Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className={LABEL_CLS} htmlFor="modal-platform">Platform</label>
              <select id="modal-platform" title="Platform" aria-label="Platform" value={platform} onChange={e => setPlatform(e.target.value)} className={`${SELECT_CLS} select-no-arrow`}>
                <option value="none">No Platform</option>
                {Object.keys(PLAT).map(k => (
                  <option key={k} value={k}>{PLAT[k].label}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className={LABEL_CLS} htmlFor="modal-content-type">Content Type</label>
              <select id="modal-content-type" title="Content Type" aria-label="Content Type" value={contentType} onChange={e => setContentType(e.target.value)} className={`${SELECT_CLS} select-no-arrow`}>
                {[["post","Feed Post"],["reel","Reel / Short"],["story","Story"],["article","Article / Blog"],["video","Long-form Video"],["podcast","Podcast Episode"],["newsletter","Newsletter"],["thread","Thread / Carousel"]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Category + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className={LABEL_CLS} htmlFor="modal-category">Category</label>
              <select id="modal-category" title="Category" aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className={`${SELECT_CLS} select-no-arrow`}>
                {[["content","Content"],["publish","Publish"],["meeting","Meeting"],["deadline","Deadline"],["research","Research"],["personal","Personal"]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className={LABEL_CLS} htmlFor="modal-status">Publish Status</label>
              <select id="modal-status" title="Publish Status" aria-label="Publish Status" value={status} onChange={e => setStatus(e.target.value)} className={`${SELECT_CLS} select-no-arrow`}>
                {[["draft","Draft"],["scheduled","Scheduled"],["published","Published"],["awaiting_review","Awaiting Review"]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL_CLS}>Internal Notes</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Private notes, reminders, or brief for this post…"
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {/* Media */}
          <div>
            <label className={LABEL_CLS}>Media / Cover Image</label>
            {!imageUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-24 bg-muted/20 border-2 border-dashed border-border hover:border-primary/40 rounded-xl cursor-pointer hover:bg-muted/30 transition-all group">
                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📷</span>
                <span className="text-[11px] font-bold text-muted-foreground">Click to attach image</span>
                <span className="text-[10px] text-muted-foreground/50">PNG, JPG, GIF, WebP</span>
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
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Needs approval banner */}
          {event?.status === "awaiting_review" && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-amber-400">Needs Approval</p>
                  <p className="text-[10px] text-amber-300/60">AI-generated content awaiting review</p>
                </div>
              </div>
              <button
                onClick={() => { if (onApprove) onApprove(event.id); onClose(); }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition-colors"
              >
                🚀 Approve
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
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-black text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
              Cancel
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
              {isEditing ? "Save Changes" : "Schedule Content"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── main calendar ───────────────────────────────────────── */

export default function ContentCalendar() {
  const { posts, addPost, updatePost, deletePost, schedulePost } = usePosts();
  const { processUJT } = useUJT();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { const json = JSON.parse(ev.target?.result as string); if (json.version === "1.0") processUJT(json); } catch {}
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Map DB posts → calendar events
  const events: CalEvent[] = posts.map((post: any) => {
    let date = fmtKey(new Date());
    let startTime = "";
    if (post.scheduledAt) { const d = parseISO(post.scheduledAt); date = fmtKey(d); startTime = format(d, "HH:mm"); }
    return {
      id: post.id,
      originalId: post.id,
      title: post.title,
      description: post.excerpt || "",
      caption: post.content || "",
      date,
      startTime,
      category: (post.category?.toLowerCase() || (post.status === "scheduled" ? "content" : post.status === "published" ? "publish" : post.status === "awaiting_review" ? "awaiting_review" : "content")),
      status: post.status,
      platform: post.platforms?.[0]?.platform?.toLowerCase() || "none",
      completed: post.status === "published",
      allDay: !post.scheduledAt,
      imageUrl: post.cover_image_url || "",
    };
  });

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
    return `Agenda · ${MONTHS[current.getMonth()]} ${current.getFullYear()}`;
  })();

  return (
    <DashboardLayout hideHeader>
      <DragDropImport onImport={(data) => { if (data.version === "1.0") processUJT(data); }} entityName="UJT">
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">

          {/* Header */}
          <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 relative z-20">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(p => !p)} 
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] text-muted-foreground transition-all mr-2"
              >
                {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <Button variant="ghost" className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground p-0 h-auto">
                <span className="text-[10px] uppercase tracking-wide font-bold">Workspace</span>
                <span className="font-bold text-foreground text-sm">My Workspace</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              <span className="text-muted-foreground/30 hidden sm:block">|</span>
              
              <div className="flex flex-col shrink-0">
                <h1 className="text-xl font-black text-foreground tracking-tight uppercase leading-none whitespace-nowrap">Calendar</h1>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none mt-0.5">Content Hub</span>
              </div>
            </div>

            <div className="flex-1 max-w-md mx-8 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 w-3.5 h-3.5" />
              <input
                aria-label="Search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search strategy..."
                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-muted-foreground/30 focus:outline-none focus:border-primary/30 transition-all"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest"><CalendarDays className="w-3 h-3" /> {todayCount}</span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest"><Send className="w-3 h-3" /> {publishCount}</span>
              </div>
              
              <NotificationsDropdown />
              <div className="w-[1px] h-4 bg-white/10 mx-1" />
              <UserDropdown />
            </div>
          </header>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            {sidebarOpen && (
              <div className="w-[240px] bg-background/20 backdrop-blur-2xl border-r border-white/[0.05] p-4 shrink-0 overflow-y-auto custom-scrollbar relative z-10">
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
              {/* Page title */}
              <div className="px-8 pt-5 pb-1 shrink-0">
                <h1 className="text-3xl font-black tracking-tight text-foreground">Calendar</h1>
              </div>
              {/* Toolbar */}
              <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b border-white/[0.05] bg-background/20 backdrop-blur-xl">
                <div className="flex items-center gap-5">
                  <div className="flex bg-white/[0.03] rounded-2xl p-1.5 border border-white/[0.08] backdrop-blur-md">
                    <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all group">
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <button
                      onClick={() => { setCurrent(new Date()); setSelectedDate(new Date()); }}
                      className={`px-6 py-1 rounded-xl text-[10px] font-black tracking-[0.1em] uppercase transition-all ${isToday(current) ? "bg-primary text-white shadow-lg shadow-primary/30" : "text-muted-foreground hover:text-white"}`}
                    >
                      Today
                    </button>
                    <button onClick={() => navigate(1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all group">
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                  <h2 className="text-lg font-black text-white tracking-tight head-neon">{headerLabel}</h2>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex bg-white/[0.03] border border-white/[0.08] rounded-2xl p-1.5 backdrop-blur-md">
                    {(["month", "week", "day", "agenda"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setViewMode(m)}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === m ? "bg-white/10 text-white shadow-xl shadow-white/5" : "text-muted-foreground hover:text-white hover:bg-white/[0.02]"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setEditingEvent(null); setDefaultDate(undefined); setModalOpen(true); }}
                    title="Add new event"
                    aria-label="Add new event"
                    className="w-11 h-11 flex items-center justify-center rounded-[1.25rem] bg-primary text-white hover:brightness-110 transition-all shadow-2xl shadow-primary/40 active:scale-95 group"
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

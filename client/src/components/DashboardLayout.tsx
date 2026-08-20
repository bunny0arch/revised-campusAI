import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { Bell, BookOpen, Bot, ChevronsUpDown, Command, LayoutDashboard, LifeBuoy, LogOut, Menu, ShieldCheck, TicketCheck, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const studentNav = [
  { label: "Workspace", path: "/", icon: Bot },
  { label: "My tickets", path: "/tickets", icon: TicketCheck },
  { label: "Resource hub", path: "/knowledge", icon: BookOpen },
  { label: "Profile", path: "/profile", icon: ShieldCheck },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return <div className="campus-shell grid min-h-screen place-items-center"><div className="glass-panel rounded-2xl px-5 py-4 text-sm text-muted-foreground">Loading CampusFix workspace…</div></div>;
  if (!user) {
    return <div className="campus-shell grid min-h-screen place-items-center px-5"><div className="glass-panel motion-enter max-w-md rounded-3xl p-8 text-center"><div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Bot className="h-7 w-7" /></div><p className="eyebrow">CampusFix AI</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Support, understood.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Sign in to access your private campus support workspace, ticket history, and verified knowledge resources.</p><Button className="mt-7 w-full" size="lg" onClick={() => startLogin()}>Sign in to CampusFix</Button></div></div>;
  }

  const nav = user.role === "admin" ? [...studentNav, { label: "IT operations", path: "/operations", icon: LayoutDashboard }] : studentNav;
  const active = nav.find(item => item.path === location)?.label ?? "CampusFix";
  const initial = user.name?.trim().slice(0, 1).toUpperCase() || "C";
  const closeAndNavigate = (path: string) => { setLocation(path); setMobileOpen(false); };

  const sidebar = <aside className="flex h-full w-[276px] flex-col border-r border-white/[0.08] bg-[#07162c]/82 p-4 backdrop-blur-xl">
    <button onClick={() => closeAndNavigate("/")} className="focus-ring flex items-center gap-3 rounded-xl p-2 text-left"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600 text-[#061427] shadow-lg shadow-cyan-500/20"><Bot className="h-5 w-5" /></span><span><span className="block font-semibold tracking-tight">CampusFix</span><span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200/70">AI support system</span></span></button>
    <div className="my-7 space-y-1">
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Workspace</p>
      {nav.map(item => <button key={item.path} onClick={() => closeAndNavigate(item.path)} className={cn("focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-150", location === item.path ? "bg-cyan-300/[0.12] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.12)]" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100")} aria-current={location === item.path ? "page" : undefined}><item.icon className="h-4 w-4" />{item.label}</button>)}
    </div>
    <div className="mt-auto space-y-3"><div className="glass-subtle rounded-xl p-3"><div className="flex items-center gap-2"><span className="status-dot" /><span className="text-xs font-medium text-cyan-100">AI services ready</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Your conversations and tickets are stored securely in your workspace.</p></div><div className="flex items-center gap-3 rounded-xl p-2"><Avatar className="h-9 w-9 border border-white/10"><AvatarFallback className="bg-blue-500/20 text-xs text-cyan-100">{initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-100">{user.name || "Campus user"}</p><p className="truncate text-xs text-slate-500">{user.role === "admin" ? "IT administrator" : "Student workspace"}</p></div><button onClick={logout} className="focus-ring rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></div></div>
  </aside>;

  return <div className="campus-shell min-h-screen"><div className="hidden h-screen lg:fixed lg:inset-y-0 lg:left-0 lg:block">{sidebar}</div>{mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /><div className="relative h-full shadow-2xl">{sidebar}<button onClick={() => setMobileOpen(false)} className="focus-ring absolute right-4 top-5 rounded-lg p-2 text-slate-300" aria-label="Close navigation"><X className="h-5 w-5" /></button></div></div>}<div className="lg:pl-[276px]"><header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[0.08] bg-[#08172e]/65 px-4 backdrop-blur-xl sm:px-7"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="focus-ring rounded-lg p-2 text-slate-300 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">CampusFix AI</p><h2 className="mt-0.5 text-sm font-semibold text-slate-100">{active}</h2></div></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="hidden border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.08] md:flex"><Command className="mr-2 h-3.5 w-3.5" />Search</Button><button onClick={() => closeAndNavigate("/tickets")} className="focus-ring relative rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100" aria-label="View notifications"><Bell className="h-4 w-4" /></button><Button size="sm" onClick={() => closeAndNavigate("/")} className="hidden sm:flex"><LifeBuoy className="mr-2 h-4 w-4" />New request</Button></div></header><main className="min-h-[calc(100vh-76px)] p-4 sm:p-7">{children}</main></div></div>;
}

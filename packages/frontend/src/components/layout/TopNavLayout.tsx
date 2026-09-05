import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Search, User, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../api/client';

export function TopNavLayout() {
  const { data: systemStatus } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: () => api.getSystemStatus(),
    retry: false, // Don't spam if 401
  });

  const isDemo = systemStatus?.mode === 'DEMO'; 

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Decorative Gradient matching the brand */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-brand-light/20 to-transparent -z-10 pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border/50 px-6 py-4 flex items-center justify-between shadow-sm">
        
        {/* Logo & Mode */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-[14px] bg-brand flex items-center justify-center text-black shadow-inner border border-white/50">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight tracking-tight text-black">AI Recovery</span>
            {systemStatus ? (
              isDemo ? (
                <span className="text-[9px] font-bold text-amber-600 tracking-widest uppercase flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> SIMULATION MODE
                </span>
              ) : (
                <span className="text-[9px] font-bold text-green-600 tracking-widest uppercase flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> LIVE SYSTEM
                </span>
              )
            ) : (
              <span className="text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-0.5">CONNECTING...</span>
            )}
          </div>
        </div>

        {/* Central Nav Links */}
        <nav className="hidden md:flex items-center gap-1 bg-gray-50/80 backdrop-blur-sm rounded-full p-1 border border-border">
          {[
            { to: "/", label: "Overview" },
            { to: "/queue", label: "Queue" },
            { to: "/experiments", label: "Experiments" },
            { to: "/webhooks", label: "Webhooks" },
            { to: "/ptp", label: "PTP Manager" },
            ...(isDemo ? [{ to: "/demo", label: "Simulator" }] : []),
          ].map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-black text-white shadow-md" 
                  : "text-content-muted hover:text-black hover:bg-gray-100/80"
              )}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input 
              type="text" 
              placeholder="Search Session ID..." 
              className="pl-9 pr-4 py-2 w-56 bg-gray-50 border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all font-medium placeholder:text-gray-400"
            />
          </div>
          <button className="w-10 h-10 rounded-full border border-border bg-white flex items-center justify-center text-content-muted hover:text-black hover:bg-gray-50 transition-colors shadow-sm">
            <Settings className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 pl-2 border-l border-border">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-black leading-tight">Admin User</div>
              <div className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Manager</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-border shadow-sm">
              <User className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full z-10">
        <Outlet />
      </main>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";

export type Archetype = "momentum" | "contrarian" | "macro" | "sentiment";

interface ArchetypeFilterProps {
  selectedArchetypes: Set<Archetype>;
  onToggle: (archetype: Archetype) => void;
  signalStats?: {
    total: number;
    highConviction: number;
    pending: number;
  };
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

/**
 * ArchetypeFilter — Sidebar component
 * Checkboxes for Momentum, Contrarian, Macro, Sentiment
 * Persists selection in URL query params + localStorage
 *
 * Mobile: Collapsible hamburger
 */
export const ArchetypeFilter: React.FC<ArchetypeFilterProps> = ({
  selectedArchetypes,
  onToggle,
  signalStats = {
    total: 0,
    highConviction: 0,
    pending: 0,
  },
  isOpen = false,
  onToggleOpen,
}) => {
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  if (!clientMounted) return null;

  const archetypes: { id: Archetype; label: string; icon: string }[] = [
    { id: "momentum", label: "Momentum", icon: "📈" },
    { id: "contrarian", label: "Contrarian", icon: "🔄" },
    { id: "macro", label: "Macro", icon: "🌍" },
    { id: "sentiment", label: "Sentiment", icon: "📱" },
  ];

  return (
    <>
      {/* Mobile: Hamburger */}
      <button
        onClick={onToggleOpen}
        className="hidden sm:hidden fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-lg bg-[#1E293B] border border-[#334155]/50 text-[#CBD5E1] hover:bg-[#334155]/50 transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Sidebar Container */}
      <aside
        className={`
          fixed md:sticky top-[80px] md:top-0 left-0 h-screen md:h-auto
          w-64 md:w-56 lg:w-64 bg-[#0F172A] border-r border-[#334155]/50
          transform transition-transform duration-300 z-40
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          overflow-y-auto md:overflow-y-visible
        `}
      >
        <div className="p-6 space-y-8">
          {/* Close button (mobile only) */}
          <button
            onClick={onToggleOpen}
            className="md:hidden absolute top-4 right-4 text-[#64748B] hover:text-white"
            aria-label="Close sidebar"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Archetype Filter */}
          <div>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              📊 Filter by Archetype
            </h3>
            <div className="space-y-3">
              {archetypes.map(({ id, label, icon }) => (
                <label key={id} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedArchetypes.has(id)}
                    onChange={() => onToggle(id)}
                    className="w-4 h-4 rounded border-[#334155]/50 bg-[#1E293B] checked:bg-[#3B82F6] cursor-pointer"
                  />
                  <span className="text-sm text-[#CBD5E1] group-hover:text-white transition-colors">
                    {icon} {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Portfolio Stats */}
          <div>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              📈 Portfolio Stats
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-[#1E293B]/50 rounded border border-[#334155]/50">
                <p className="text-xs text-[#64748B] mb-1">Total signals</p>
                <p className="text-2xl font-bold text-white">
                  {signalStats.total}
                </p>
              </div>
              <div className="p-3 bg-[#1E293B]/50 rounded border border-[#334155]/50">
                <p className="text-xs text-[#64748B] mb-1">High conviction</p>
                <p className="text-2xl font-bold text-[#10B981]">
                  {signalStats.highConviction}
                </p>
              </div>
              <div className="p-3 bg-[#1E293B]/50 rounded border border-[#334155]/50">
                <p className="text-xs text-[#64748B] mb-1">Pending approval</p>
                <p className="text-2xl font-bold text-[#F59E0B]">
                  {signalStats.pending}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onToggleOpen}
        />
      )}
    </>
  );
};

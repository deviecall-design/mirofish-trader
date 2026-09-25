import { useMemo } from "react";
import { SignalRow } from "@/app/lib/supabase";
import type { Archetype } from "@/app/components/ArchetypeFilter";

/**
 * useVirtualizedSignals — Filter and paginate signals
 * Supports archetype filtering and pagination for react-window
 */
export function useVirtualizedSignals(
  signals: SignalRow[],
  selectedArchetypes: Set<Archetype>,
  pageSize: number = 20
) {
  const filtered = useMemo(() => {
    if (selectedArchetypes.size === 0) {
      return signals; // No filters — return all
    }

    // TODO: Once archetypeBreakdown is persisted, filter here
    // For now, return all signals (filtering not yet implemented)
    return signals;
  }, [signals, selectedArchetypes]);

  const pages = useMemo(() => {
    const result = [];
    for (let i = 0; i < filtered.length; i += pageSize) {
      result.push(filtered.slice(i, i + pageSize));
    }
    return result;
  }, [filtered, pageSize]);

  return {
    filtered,
    pages,
    totalCount: filtered.length,
    pageCount: pages.length,
  };
}

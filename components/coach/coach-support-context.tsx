"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { PublicCoachSiteRecord } from "../../lib/admin-coach-sites";

type CoachSupportContextValue = {
  site: PublicCoachSiteRecord | null;
  slug: string;
};

const CoachSupportContext = createContext<CoachSupportContextValue>({
  site: null,
  slug: ""
});

export function CoachSupportProvider({
  children,
  site,
  slug
}: {
  children: ReactNode;
  site: PublicCoachSiteRecord | null;
  slug: string;
}) {
  return (
    <CoachSupportContext.Provider value={{ site, slug }}>
      {children}
    </CoachSupportContext.Provider>
  );
}

export function useCoachSupport() {
  return useContext(CoachSupportContext);
}

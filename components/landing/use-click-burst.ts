"use client";

import { useCallback, useState } from "react";

export function useClickBurst() {
  const [burstKey, setBurstKey] = useState(0);

  const triggerBurst = useCallback(() => {
    setBurstKey((current) => current + 1);
  }, []);

  return { burstKey, triggerBurst };
}

"use client";

import { useEffect, useState } from "react";

const HIGH_SLOT_MIN = 12;
const HIGH_SLOT_MAX = 20;
const STEP_DELAY_MIN_MS = 240000;
const STEP_DELAY_MAX_MS = 420000;
const RESET_DELAY_MIN_MS = 240000;
const RESET_DELAY_MAX_MS = 420000;
const DROP_WEIGHTS = [1, 1, 1, 1, 1, 2, 2, 3];

type SlotState = {
  count: number;
  previousDrop: number | null;
};

function randomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nextHighSlot() {
  return randomInteger(HIGH_SLOT_MIN, HIGH_SLOT_MAX);
}

function nextLowerSlot({ count, previousDrop }: SlotState): SlotState {
  if (count <= 1) {
    return {
      count: nextHighSlot(),
      previousDrop: null
    };
  }

  const maxDrop = Math.min(3, count - 1);
  const weightedDrops = DROP_WEIGHTS.filter((drop) => drop <= maxDrop);
  const variedDrops = weightedDrops.filter((drop) => drop !== previousDrop);
  const dropOptions = variedDrops.length > 0 ? variedDrops : weightedDrops;
  const drop = dropOptions[randomInteger(0, dropOptions.length - 1)];

  return {
    count: count - drop,
    previousDrop: drop
  };
}

function nextInterval(current: number) {
  if (current <= 1) {
    return randomInteger(RESET_DELAY_MIN_MS, RESET_DELAY_MAX_MS);
  }

  return randomInteger(STEP_DELAY_MIN_MS, STEP_DELAY_MAX_MS);
}

export function DisplaySlotCycle() {
  const [slotState, setSlotState] = useState<SlotState | null>(null);

  useEffect(() => {
    let timeoutId: number | undefined;
    let currentState: SlotState;

    function scheduleNext() {
      timeoutId = window.setTimeout(() => {
        currentState = nextLowerSlot(currentState);
        setSlotState(currentState);
        scheduleNext();
      }, nextInterval(currentState.count));
    }

    timeoutId = window.setTimeout(() => {
      currentState = {
        count: nextHighSlot(),
        previousDrop: null
      };

      setSlotState(currentState);
      scheduleNext();
    }, 80);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <span className="display-slot-cycle" aria-live="polite">
      <strong>{slotState?.count ?? "--"}</strong> slots
    </span>
  );
}

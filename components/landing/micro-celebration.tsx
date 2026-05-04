"use client";

type MicroCelebrationProps = {
  burstKey: number;
};

export function MicroCelebration({ burstKey }: MicroCelebrationProps) {
  if (burstKey === 0) {
    return null;
  }

  return (
    <span className="micro-celebration" aria-hidden="true" key={burstKey}>
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

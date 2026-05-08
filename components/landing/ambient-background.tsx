export function AmbientBackground() {
  return (
    <div
      className="ambient-background ambient-background--grainient ambient-background--css-only"
      aria-hidden="true"
    >
      <span className="grainient-skeleton" />
      <span className="ambient-background__readability-veil" />
    </div>
  );
}

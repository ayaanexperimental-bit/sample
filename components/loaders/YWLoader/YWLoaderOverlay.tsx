import { PageSkeleton, type PageSkeletonVariant } from "../PageSkeletons";
import { YWAtomLoader } from "./YWAtomLoader";
import styles from "./YWLoaderOverlay.module.css";

export type LoaderVariant = PageSkeletonVariant;

export function YWLoaderOverlay({
  label = "Loading YW Coach",
  variant = "guest"
}: {
  label?: string;
  variant?: LoaderVariant;
}) {
  return (
    <main
      aria-label={label}
      className={`${styles.overlay} ${styles[variant]}`}
      role="status"
    >
      <PageSkeleton variant={variant} />
      <section className={styles.loaderLayer} aria-live="polite">
        <YWAtomLoader label={label} size="lg" />
      </section>
    </main>
  );
}

import type { CSSProperties } from "react";
import styles from "./PageSkeletons.module.css";

export type PageSkeletonVariant = "guest" | "paid" | "profile" | "success";

type SkeletonStyle = CSSProperties & {
  "--skeleton-index"?: number;
};

function SkeletonBlock({
  className,
  index
}: {
  className: string;
  index: number;
}) {
  return (
    <span
      className={`${styles.block} ${className}`}
      style={{ "--skeleton-index": index } as SkeletonStyle}
    />
  );
}

export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  if (variant === "paid") {
    return <PaidPageSkeleton />;
  }

  if (variant === "success") {
    return <SuccessPageSkeleton />;
  }

  if (variant === "profile") {
    return <ProfilePageSkeleton />;
  }

  return <GuestPageSkeleton />;
}

export function GuestPageSkeleton() {
  return (
    <section className={`${styles.skeleton} ${styles.guest}`} aria-hidden="true">
      <SkeletonBlock className={styles.hook} index={0} />
      <SkeletonBlock className={styles.kicker} index={1} />
      <SkeletonBlock className={styles.headline} index={2} />
      <SkeletonBlock className={styles.copy} index={3} />
      <SkeletonBlock className={styles.cta} index={4} />
      <SkeletonBlock className={styles.media} index={5} />
      <SkeletonBlock className={styles.coachTag} index={6} />
    </section>
  );
}

export function PaidPageSkeleton() {
  return (
    <section className={`${styles.skeleton} ${styles.paid}`} aria-hidden="true">
      <SkeletonBlock className={styles.hook} index={0} />
      <SkeletonBlock className={styles.kicker} index={1} />
      <SkeletonBlock className={styles.headline} index={2} />
      <SkeletonBlock className={styles.copy} index={3} />
      <SkeletonBlock className={styles.video} index={4} />
      <SkeletonBlock className={styles.timer} index={5} />
      <SkeletonBlock className={styles.checkout} index={6} />
    </section>
  );
}

export function SuccessPageSkeleton() {
  return (
    <section className={`${styles.skeleton} ${styles.success}`} aria-hidden="true">
      <SkeletonBlock className={styles.successCard} index={0} />
      <SkeletonBlock className={styles.video} index={1} />
      <SkeletonBlock className={styles.whatsapp} index={2} />
      <SkeletonBlock className={styles.nextStep} index={3} />
    </section>
  );
}

export function ProfilePageSkeleton() {
  return (
    <section className={`${styles.skeleton} ${styles.profile}`} aria-hidden="true">
      <SkeletonBlock className={styles.avatar} index={0} />
      <SkeletonBlock className={styles.bio} index={1} />
      <SkeletonBlock className={styles.expertise} index={2} />
      <SkeletonBlock className={styles.proof} index={3} />
      <SkeletonBlock className={styles.cta} index={4} />
    </section>
  );
}

import {
  YWLoaderOverlay,
  type LoaderVariant
} from "@/components/loaders/YWLoader";

export function YWBrandLoader({
  label = "Loading YW Coach",
  variant = "guest"
}: {
  label?: string;
  variant?: LoaderVariant;
}) {
  return <YWLoaderOverlay label={label} variant={variant} />;
}

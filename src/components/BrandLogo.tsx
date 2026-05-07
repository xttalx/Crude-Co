type Props = {
  className?: string;
};

/** Wordmark using `--font-logo` (Outfit), defined in root layout. */
export function BrandLogo({ className = "" }: Props) {
  return (
    <span
      className={`font-brand-logo text-[17px] font-bold tracking-[-0.03em] text-zinc-950 dark:text-zinc-50 ${className}`}
    >
      SpendSnap
    </span>
  );
}

import { StorySection } from "./StorySection";

interface NarrativeSectionProps {
  eyebrow: string;
  title: string;
  body: string;
}

/** Generic content beat for the landing story — reusable for any future marketing copy. */
export function NarrativeSection({ eyebrow, title, body }: NarrativeSectionProps) {
  return (
    <StorySection className="text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-wide text-accent-secondary">{eyebrow}</p>
      <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">{body}</p>
    </StorySection>
  );
}
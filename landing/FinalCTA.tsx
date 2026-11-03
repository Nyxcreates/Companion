import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CharacterPlaceholder } from "@/components/character/CharacterPlaceholder";
import { StorySection } from "./StorySection";

export function FinalCTA() {
  return (
    <StorySection className="flex flex-col items-center gap-5 pb-32 text-center">
      <CharacterPlaceholder size={72} />
      <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">Ready when you are.</h2>
      <p className="max-w-md text-ink-secondary">
        No streaks to lose. No pressure to keep up. Just a small presence, waiting to grow alongside you.
      </p>
      <Link href="/signup">
        <Button variant="primary" size="lg">
          Meet your companion
        </Button>
      </Link>
    </StorySection>
  );
}
import Link from "next/link";
import { CharacterPlaceholder } from "@/components/character/CharacterPlaceholder";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4 text-center">
      <CharacterPlaceholder size={72} />
      <div>
        <h1 className="text-xl font-semibold text-moon">This page wandered off.</h1>
        <p className="mt-1 text-sm text-moon/50">Let's head back home.</p>
      </div>
      <Link href="/">
        <Button variant="secondary">Back to Companion</Button>
      </Link>
    </div>
  );
}
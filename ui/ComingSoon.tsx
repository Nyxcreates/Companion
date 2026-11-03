import { EmptyState } from "@/components/ui/EmptyState";

interface ComingSoonProps {
  screenName: string;
  note?: string;
}

export function ComingSoon({ screenName, note }: ComingSoonProps) {
  return <EmptyState title={screenName} message={note ?? "This part of Companion is still being built."} />;
}
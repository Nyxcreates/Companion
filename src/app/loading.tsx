import { LoadingState } from "@/components/ui/LoadingState";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingState />
    </div>
  );
}
import { redirect } from "next/navigation";

/** Moved: this destination now lives inside a grouped area. Kept so old links and bookmarks still work. */
export default function LegacyRedirect() {
  redirect("/memories?tab=garden");
}
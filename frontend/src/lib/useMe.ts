import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { MeOut } from "@/lib/types";

// Shared "who am I" query — the session gate and the layout read the same cache entry.
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeOut>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

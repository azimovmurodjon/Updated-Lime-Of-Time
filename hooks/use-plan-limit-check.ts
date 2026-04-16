/**
 * usePlanLimitCheck
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns the current plan limits and a helper to check if a resource limit
 * has been reached. Used to show the UpgradePlanSheet before adding items.
 */
import { useStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";

export type LimitResource = "clients" | "services" | "staff" | "products" | "locations";

export interface PlanLimitInfo {
  allowed: boolean;
  currentLimit: number;
  currentCount: number;
  planKey: string;
  planName: string;
}

export function usePlanLimitCheck() {
  const { state } = useStore();
  const businessOwnerId = state.businessOwnerId;

  const { data: planInfo, isLoading: planLoading } = trpc.subscription.getMyPlan.useQuery(
    { businessOwnerId: businessOwnerId! },
    { enabled: !!businessOwnerId, staleTime: 60_000 }
  );

  /**
   * Check if adding one more item of the given resource is allowed.
   * Returns { allowed, currentLimit, currentCount, planKey, planName }
   *
   * IMPORTANT: If planInfo hasn't loaded yet (businessOwnerId is null or query
   * is still in flight), we optimistically allow the action to avoid false
   * upgrade-sheet blocks on first open.
   */
  function checkLimit(resource: LimitResource): PlanLimitInfo {
    // If plan data hasn't loaded yet, allow the action optimistically
    if (!businessOwnerId || (planLoading && !planInfo)) {
      return {
        allowed: true,
        currentLimit: -1,
        currentCount: 0,
        planKey: "solo",
        planName: "Solo",
      };
    }

    const planKey = planInfo?.planKey ?? "solo";
    const planName = planInfo?.displayName ?? "Solo";
    const limits = planInfo?.limits;

    const countMap: Record<LimitResource, number> = {
      clients: state.clients.length,
      services: state.services.length,
      staff: state.staff.length,
      products: state.products.length,
      locations: state.locations.length,
    };

    const limitMap: Record<LimitResource, number> = {
      clients: limits?.maxClients ?? 20,
      services: limits?.maxServices ?? 5,
      staff: limits?.maxStaff ?? 1,
      products: limits?.maxProducts ?? 5,
      locations: limits?.maxLocations ?? 1,
    };

    const currentCount = countMap[resource];
    const currentLimit = limitMap[resource];

    // -1 means unlimited
    const allowed = currentLimit === -1 || currentCount < currentLimit;

    return { allowed, currentLimit, currentCount, planKey, planName };
  }

  return { checkLimit, planInfo };
}

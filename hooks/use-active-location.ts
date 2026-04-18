import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { Location, StaffMember, WorkingHours } from "@/lib/types";

export interface ActiveLocationContext {
  /** The currently active location object, or null if none selected */
  activeLocation: Location | null;
  /** All active locations for this business */
  activeLocations: Location[];
  /** Whether the business has more than one active location */
  hasMultipleLocations: boolean;
  /** Staff members assigned to (or compatible with) the active location */
  staffForLocation: StaffMember[];
  /** Effective working hours: location-specific if set, otherwise falls back to business hours */
  effectiveWorkingHours: Record<string, WorkingHours>;
  /** Set the active location (persisted to AsyncStorage) */
  setActiveLocation: (locationId: string | null) => void;
}

export function useActiveLocation(): ActiveLocationContext {
  const { state, setActiveLocation } = useStore();
  const { locations, staff, settings, activeLocationId } = state;

  const activeLocations = useMemo(
    () => locations.filter((l) => l.active),
    [locations]
  );

  const activeLocation = useMemo(
    () => (activeLocationId ? locations.find((l) => l.id === activeLocationId) ?? null : null),
    [locations, activeLocationId]
  );

  const hasMultipleLocations = activeLocations.length > 1;

  const staffForLocation = useMemo(() => {
    if (!activeLocationId) return staff.filter((s) => s.active);
    return staff.filter((s) => {
      if (!s.active) return false;
      // null locationIds means staff works at all locations
      if (!s.locationIds || s.locationIds.length === 0) return true;
      return s.locationIds.includes(activeLocationId);
    });
  }, [staff, activeLocationId]);

  const effectiveWorkingHours = useMemo<Record<string, WorkingHours>>(() => {
    if (activeLocation?.workingHours && Object.keys(activeLocation.workingHours).length > 0) {
      return activeLocation.workingHours as Record<string, WorkingHours>;
    }
    return settings.workingHours;
  }, [activeLocation, settings.workingHours]);

  return {
    activeLocation,
    activeLocations,
    hasMultipleLocations,
    staffForLocation,
    effectiveWorkingHours,
    setActiveLocation,
  };
}

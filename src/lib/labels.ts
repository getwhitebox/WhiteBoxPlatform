// Plain-English labels for values stored in the database.
import type { ContainerStatus } from "@/generated/prisma/client";

/** In the order they're shown on the dashboard. */
export const CONTAINER_STATUS_LABELS: Record<ContainerStatus, string> = {
  AVAILABLE: "Available",
  ON_RENT: "On rent",
  IN_STORAGE: "In storage",
  RESERVED: "Reserved",
  IN_TRANSIT: "In transit",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
};

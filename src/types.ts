export type RouteAllocationMode = "FIXED_TARGET" | "RESIDUAL" | "UNLIMITED";
export type FreightResponsibility = "SHIPPER" | "CONSIGNEE" | "CARRIER";

export interface TransportRoute {
  id: string;
  routeCode: string;
  label: string;
  destinationFacility: string;
  targetWeightKg: number;
  allocationMode: RouteAllocationMode;
  freightResponsibility: FreightResponsibility;
}

export interface ScaleTicket {
  ticketId: string;
  scaleNumber: string;
  truckPlate: string;
  grossWeightKg: number;
  tareWeightKg: number;
  netWeightKg: number;
  timestamp: string;
  manifestId?: string;
  invoiceKey?: string;
}

export interface CargoManifest {
  manifestId: string;
  vesselName: string;
  commodityGrade: string;
  billedWeightKg: number;
  tolerancePercentage: number;
}

export interface ReconciliationResult {
  manifestId: string;
  totalWeighedKg: number;
  billedWeightKg: number;
  varianceKg: number;
  variancePercentage: number;
  withinTolerance: boolean;
  status: "APPROVED" | "FLAGGED_FOR_AUDIT" | "REJECTED";
  ticketCount: number;
}

export interface InboundScaleLot {
  lotId: string;
  arrivalSequence: number;
  arrivedAt: string;
  remainingWeightKg: number;
}

export interface FifoReturnAllocation {
  lotId: string;
  arrivalSequence: number;
  allocatedWeightKg: number;
  remainingAfterKg: number;
}

export interface ScreeningTicket {
  ticketId: string;
  rawInputKg: number;
  screenedPrimaryKg: number;
  finesRecoveredKg: number;
  occurredAt: string;
}

export interface ScreeningReconciliationResult {
  ticketCount: number;
  totalRawInputKg: number;
  totalScreenedPrimaryKg: number;
  totalFinesRecoveredKg: number;
  unaccountedLossKg: number;
  lossPercentage: number;
  primaryYieldPercentage: number;
  withinTolerance: boolean;
  status: "APPROVED" | "FLAGGED_FOR_AUDIT";
}

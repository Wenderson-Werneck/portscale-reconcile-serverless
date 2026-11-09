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

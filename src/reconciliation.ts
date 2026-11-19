import {
  ScaleTicket,
  CargoManifest,
  ReconciliationResult,
  InboundScaleLot,
  FifoReturnAllocation,
  ScreeningTicket,
  ScreeningReconciliationResult,
} from "./types.js";

export class WeighbridgeReconciler {
  /**
   * Reconciles a batch of scale tickets against a master maritime cargo manifest.
   * Evaluates operational weight tolerance, tare integrity, and batch variance.
   */
  public static reconcileManifest(
    manifest: CargoManifest,
    tickets: ScaleTicket[]
  ): ReconciliationResult {
    let totalNetKg = 0;

    for (const ticket of tickets) {
      // Integrity check: Net must strictly equal Gross - Tare
      const expectedNet = ticket.grossWeightKg - ticket.tareWeightKg;
      if (Math.abs(expectedNet - ticket.netWeightKg) > 1.0) {
        throw new Error(
          `SCALE_INTEGRITY_VIOLATION: Ticket ${ticket.ticketId} has net mismatch (Expected: ${expectedNet}, Recorded: ${ticket.netWeightKg})`
        );
      }
      totalNetKg += ticket.netWeightKg;
    }

    const varianceKg = totalNetKg - manifest.billedWeightKg;
    const variancePercentage = (varianceKg / manifest.billedWeightKg) * 100;
    const maxAllowedKg = manifest.billedWeightKg * (manifest.tolerancePercentage / 100);

    const withinTolerance = Math.abs(varianceKg) <= maxAllowedKg;

    let status: ReconciliationResult["status"] = "APPROVED";
    if (!withinTolerance) {
      status = Math.abs(variancePercentage) > 2.0 ? "REJECTED" : "FLAGGED_FOR_AUDIT";
    }

    return {
      manifestId: manifest.manifestId,
      totalWeighedKg: Math.round(totalNetKg),
      billedWeightKg: manifest.billedWeightKg,
      varianceKg: Math.round(varianceKg),
      variancePercentage: Number(variancePercentage.toFixed(3)),
      withinTolerance,
      status,
      ticketCount: tickets.length,
    };
  }

  /**
   * Calculates monthly storage rate tier based on current warehouse balance.
   */
  public static calculateStorageCentsPerTonne(currentStockKg: number): number {
    if (!Number.isFinite(currentStockKg) || currentStockKg < 0) {
      throw new Error("INVALID_STOCK_LEVEL");
    }
    if (currentStockKg >= 1_000_000) return 530; // High volume tier: €5.30 / ton
    if (currentStockKg >= 750_000) return 850;   // Medium volume tier: €8.50 / ton
    return 1_100;                                 // Standard tier: €11.00 / ton
  }

  /**
   * Allocates an outbound or return invoice weight strictly FIFO by weighbridge arrival sequence.
   */
  public static allocateReturnFifo(
    lots: InboundScaleLot[],
    requestedWeightKg: number
  ): FifoReturnAllocation[] {
    if (!Number.isFinite(requestedWeightKg) || requestedWeightKg <= 0) {
      throw new Error("INVALID_ALLOCATION_WEIGHT: Must be positive non-zero value");
    }

    const orderedLots = [...lots]
      .filter((lot) => lot.remainingWeightKg > 0)
      .sort((a, b) => a.arrivalSequence - b.arrivalSequence || a.arrivedAt.localeCompare(b.arrivedAt));

    const totalAvailable = orderedLots.reduce((acc, lot) => acc + lot.remainingWeightKg, 0);
    if (totalAvailable < requestedWeightKg) {
      throw new Error(
        `INSUFFICIENT_FIFO_BALANCE: Available ${totalAvailable} kg, requested ${requestedWeightKg} kg`
      );
    }

    const allocations: FifoReturnAllocation[] = [];
    let pendingKg = requestedWeightKg;

    for (const lot of orderedLots) {
      if (pendingKg <= 0) break;
      const takeKg = Math.min(lot.remainingWeightKg, pendingKg);
      allocations.push({
        lotId: lot.lotId,
        arrivalSequence: lot.arrivalSequence,
        allocatedWeightKg: Number(takeKg.toFixed(2)),
        remainingAfterKg: Number((lot.remainingWeightKg - takeKg).toFixed(2)),
      });
      pendingKg -= takeKg;
    }

    return allocations;
  }

  /**
   * Reconciles bulk screening/sieving batches: raw input vs. screened primary grade + recovered fines.
   */
  public static reconcileScreeningYield(
    tickets: ScreeningTicket[],
    maxLossPercentage = 1.5
  ): ScreeningReconciliationResult {
    if (tickets.length === 0) {
      throw new Error("EMPTY_SCREENING_BATCH: At least one ticket is required");
    }

    let totalRawInputKg = 0;
    let totalScreenedPrimaryKg = 0;
    let totalFinesRecoveredKg = 0;

    for (const t of tickets) {
      if (t.rawInputKg <= 0 || t.screenedPrimaryKg < 0 || t.finesRecoveredKg < 0) {
        throw new Error(`INVALID_SCREENING_TICKET: ${t.ticketId}`);
      }
      totalRawInputKg += t.rawInputKg;
      totalScreenedPrimaryKg += t.screenedPrimaryKg;
      totalFinesRecoveredKg += t.finesRecoveredKg;
    }

    const accountedKg = totalScreenedPrimaryKg + totalFinesRecoveredKg;
    const unaccountedLossKg = Number((totalRawInputKg - accountedKg).toFixed(2));
    const lossPercentage = Number(((unaccountedLossKg / totalRawInputKg) * 100).toFixed(3));
    const primaryYieldPercentage = Number(((totalScreenedPrimaryKg / totalRawInputKg) * 100).toFixed(2));
    const withinTolerance = Math.abs(lossPercentage) <= maxLossPercentage;

    return {
      ticketCount: tickets.length,
      totalRawInputKg: Number(totalRawInputKg.toFixed(2)),
      totalScreenedPrimaryKg: Number(totalScreenedPrimaryKg.toFixed(2)),
      totalFinesRecoveredKg: Number(totalFinesRecoveredKg.toFixed(2)),
      unaccountedLossKg,
      lossPercentage,
      primaryYieldPercentage,
      withinTolerance,
      status: withinTolerance ? "APPROVED" : "FLAGGED_FOR_AUDIT",
    };
  }
}

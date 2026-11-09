import { ScaleTicket, CargoManifest, ReconciliationResult } from "./types.js";

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
}

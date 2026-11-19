// @ts-ignore
import test from "node:test";
// @ts-ignore
import assert from "node:assert/strict";
import { WeighbridgeReconciler } from "./reconciliation.js";
import { IndustrialInventoryLedger } from "./inventory.js";
import { CargoManifest, ScaleTicket } from "./types.js";

test("WeighbridgeReconciler: accurately approves batches within tolerance", () => {
  const manifest: CargoManifest = {
    manifestId: "MAN-2025-0891",
    vesselName: "M/V Atlantic Explorer",
    commodityGrade: "Ferro-Manganese High Carbon",
    billedWeightKg: 100_000,
    tolerancePercentage: 0.5, // 0.5% tolerance = +- 500 kg
  };

  const tickets: ScaleTicket[] = [
    {
      ticketId: "TKT-001",
      scaleNumber: "SCALE-01",
      truckPlate: "XYZ-9821",
      grossWeightKg: 45_200,
      tareWeightKg: 15_100,
      netWeightKg: 30_100,
      timestamp: "2025-09-10T08:30:00Z",
    },
    {
      ticketId: "TKT-002",
      scaleNumber: "SCALE-01",
      truckPlate: "ABC-1234",
      grossWeightKg: 50_000,
      tareWeightKg: 15_000,
      netWeightKg: 35_000,
      timestamp: "2025-09-10T09:15:00Z",
    },
    {
      ticketId: "TKT-003",
      scaleNumber: "SCALE-02",
      truckPlate: "DEF-5678",
      grossWeightKg: 50_150,
      tareWeightKg: 15_000,
      netWeightKg: 35_150,
      timestamp: "2025-09-10T10:00:00Z",
    },
  ];

  const result = WeighbridgeReconciler.reconcileManifest(manifest, tickets);

  assert.equal(result.totalWeighedKg, 100_250);
  assert.equal(result.varianceKg, 250);
  assert.equal(result.withinTolerance, true);
  assert.equal(result.status, "APPROVED");
});

test("WeighbridgeReconciler: flags batches exceeding operational tolerance", () => {
  const manifest: CargoManifest = {
    manifestId: "MAN-2025-0892",
    vesselName: "M/V Pacific Pioneer",
    commodityGrade: "Silicon Metal Grade 553",
    billedWeightKg: 50_000,
    tolerancePercentage: 0.3, // +- 150 kg
  };

  const tickets: ScaleTicket[] = [
    {
      ticketId: "TKT-101",
      scaleNumber: "SCALE-01",
      truckPlate: "TRK-0011",
      grossWeightKg: 65_000,
      tareWeightKg: 16_000,
      netWeightKg: 49_000, // 1000 kg shortage (> 0.3%)
      timestamp: "2025-09-11T11:00:00Z",
    },
  ];

  const result = WeighbridgeReconciler.reconcileManifest(manifest, tickets);

  assert.equal(result.withinTolerance, false);
  assert.equal(result.status, "FLAGGED_FOR_AUDIT");
});

test("IndustrialInventoryLedger: enforces strict non-negative state transitions", () => {
  const ledger = new IndustrialInventoryLedger({ rawPortStockKg: 20_000 });

  ledger.applyEvent({
    id: "EVT-01",
    type: "PROCESSING",
    occurredAt: "2025-09-12T14:00:00Z",
    quantityKg: 15_000,
  });

  let snapshot = ledger.getSnapshot();
  assert.equal(snapshot.rawPortStockKg, 5_000);
  assert.equal(snapshot.processedStockKg, 15_000);

  // Attempting to dispatch more than available should throw
  assert.throws(() => {
    ledger.applyEvent({
      id: "EVT-02",
      type: "DISPATCH_SALE",
      occurredAt: "2025-09-12T16:00:00Z",
      quantityKg: 18_000, // Exceeds 15,000 kg
    });
  }, /INSUFFICIENT_PROCESSED_STOCK/);
});

test("WeighbridgeReconciler: allocates return invoices strictly FIFO by arrival sequence", () => {
  const lots = [
    { lotId: "LOT-03", arrivalSequence: 3, arrivedAt: "2025-09-12T10:00:00Z", remainingWeightKg: 20_000 },
    { lotId: "LOT-01", arrivalSequence: 1, arrivedAt: "2025-09-10T08:00:00Z", remainingWeightKg: 15_000 },
    { lotId: "LOT-02", arrivalSequence: 2, arrivedAt: "2025-09-11T09:00:00Z", remainingWeightKg: 25_000 },
  ];

  const allocations = WeighbridgeReconciler.allocateReturnFifo(lots, 32_000);

  assert.equal(allocations.length, 2);
  assert.equal(allocations[0].lotId, "LOT-01");
  assert.equal(allocations[0].allocatedWeightKg, 15_000);
  assert.equal(allocations[0].remainingAfterKg, 0);
  assert.equal(allocations[1].lotId, "LOT-02");
  assert.equal(allocations[1].allocatedWeightKg, 17_000);
  assert.equal(allocations[1].remainingAfterKg, 8_000);

  assert.throws(() => {
    WeighbridgeReconciler.allocateReturnFifo(lots, 99_000);
  }, /INSUFFICIENT_FIFO_BALANCE/);
});

test("WeighbridgeReconciler: reconciles bulk screening yield and flags excess process loss", () => {
  const approved = WeighbridgeReconciler.reconcileScreeningYield(
    [
      { ticketId: "SCR-01", rawInputKg: 40_000, screenedPrimaryKg: 35_200, finesRecoveredKg: 4_500, occurredAt: "2025-09-13T10:00:00Z" },
      { ticketId: "SCR-02", rawInputKg: 60_000, screenedPrimaryKg: 52_800, finesRecoveredKg: 6_700, occurredAt: "2025-09-13T14:00:00Z" },
    ],
    1.5
  );

  assert.equal(approved.totalRawInputKg, 100_000);
  assert.equal(approved.unaccountedLossKg, 800);
  assert.equal(approved.lossPercentage, 0.8);
  assert.equal(approved.primaryYieldPercentage, 88);
  assert.equal(approved.status, "APPROVED");

  const flagged = WeighbridgeReconciler.reconcileScreeningYield(
    [
      { ticketId: "SCR-03", rawInputKg: 50_000, screenedPrimaryKg: 40_000, finesRecoveredKg: 7_500, occurredAt: "2025-09-14T10:00:00Z" },
    ],
    1.5
  );
  assert.equal(flagged.withinTolerance, false);
  assert.equal(flagged.status, "FLAGGED_FOR_AUDIT");
});

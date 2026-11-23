const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { WeighbridgeReconciler, IndustrialInventoryLedger } = require("../dist/index.js");

const PORT = Number(process.env.PORT || 3001);

const defaultManifest = {
  manifestId: "MAN-2026-BALTIC-412",
  vesselName: "M/V Northern Horizon",
  commodityGrade: "Ferro-Manganese High Carbon (Synthetic)",
  billedWeightKg: 100000,
  tolerancePercentage: 0.5,
};

const defaultTickets = [
  { ticketId: "TKT-9001", scaleNumber: "SCALE-NORTH-01", truckPlate: "EE-412-KLM", grossWeightKg: 45200, tareWeightKg: 15100, netWeightKg: 30100, timestamp: "2026-11-18T08:15:00Z" },
  { ticketId: "TKT-9002", scaleNumber: "SCALE-NORTH-01", truckPlate: "EE-883-TLL", grossWeightKg: 50050, tareWeightKg: 15000, netWeightKg: 35050, timestamp: "2026-11-18T09:40:00Z" },
  { ticketId: "TKT-9003", scaleNumber: "SCALE-NORTH-02", truckPlate: "EE-209-TRT", grossWeightKg: 50120, tareWeightKg: 14920, netWeightKg: 35200, timestamp: "2026-11-18T11:05:00Z" },
];

const defaultLots = [
  { lotId: "LOT-2026-A01", arrivalSequence: 1, arrivedAt: "2026-11-10T08:00:00Z", remainingWeightKg: 18500 },
  { lotId: "LOT-2026-A02", arrivalSequence: 2, arrivedAt: "2026-11-12T11:30:00Z", remainingWeightKg: 26400 },
  { lotId: "LOT-2026-A03", arrivalSequence: 3, arrivedAt: "2026-11-15T15:10:00Z", remainingWeightKg: 31200 },
];

const defaultScreening = [
  { ticketId: "SCR-401", rawInputKg: 42000, screenedPrimaryKg: 36960, finesRecoveredKg: 4680, occurredAt: "2026-11-17T09:00:00Z" },
  { ticketId: "SCR-402", rawInputKg: 58000, screenedPrimaryKg: 51120, finesRecoveredKg: 6410, occurredAt: "2026-11-17T14:20:00Z" },
];

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (req.method === "POST" && req.url === "/api/reconcile") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const manifest = payload.manifest || defaultManifest;
        const tickets = payload.tickets || defaultTickets;
        const fifoRequestKg = Number(payload.fifoRequestKg || 34000);
        const maxLossPct = Number(payload.maxLossPct || 1.5);

        const reconciliation = WeighbridgeReconciler.reconcileManifest(manifest, tickets);
        const fifoAllocations = WeighbridgeReconciler.allocateReturnFifo(defaultLots, fifoRequestKg);
        const screening = WeighbridgeReconciler.reconcileScreeningYield(defaultScreening, maxLossPct);
        const storageCentsPerTon = WeighbridgeReconciler.calculateStorageCentsPerTonne(reconciliation.totalWeighedKg * 8);

        const ledger = new IndustrialInventoryLedger({ rawPortStockKg: reconciliation.totalWeighedKg });
        ledger.applyEvent({ id: "EVT-PROC-1", type: "PROCESSING", occurredAt: "2026-11-18T13:00:00Z", quantityKg: Math.round(reconciliation.totalWeighedKg * 0.72) });
        ledger.applyEvent({ id: "EVT-DISP-1", type: "DISPATCH_SALE", occurredAt: "2026-11-18T16:00:00Z", quantityKg: fifoRequestKg });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            manifest,
            tickets,
            reconciliation,
            fifoLots: defaultLots,
            fifoRequestKg,
            fifoAllocations,
            screening,
            storageEurPerTon: Number((storageCentsPerTon / 100).toFixed(2)),
            ledgerSnapshot: ledger.getSnapshot(),
          })
        );
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\nPortScale Reconcile Serverless Demo running at http://127.0.0.1:${PORT}\n`);
});

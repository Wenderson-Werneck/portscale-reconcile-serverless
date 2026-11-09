import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const mockManifests = [
  {
    manifestId: "MAN-2025-0891",
    vesselName: "M/V Atlantic Explorer",
    commodityGrade: "Ferro-Manganese High Carbon",
    billedWeightKg: 100000,
    tolerancePercentage: 0.5
  },
  {
    manifestId: "MAN-2025-0892",
    vesselName: "M/V Pacific Pioneer",
    commodityGrade: "Silicon Metal Grade 553",
    billedWeightKg: 50000,
    tolerancePercentage: 0.3
  }
];

const mockTickets = [
  {
    ticketId: "TKT-001",
    scaleNumber: "SCALE-01",
    truckPlate: "XYZ-9821",
    grossWeightKg: 45200,
    tareWeightKg: 15100,
    netWeightKg: 30100,
    timestamp: "2025-09-10T08:30:00Z",
    manifestId: "MAN-2025-0891"
  },
  {
    ticketId: "TKT-002",
    scaleNumber: "SCALE-01",
    truckPlate: "ABC-1234",
    grossWeightKg: 50000,
    tareWeightKg: 15000,
    netWeightKg: 35000,
    timestamp: "2025-09-10T09:15:00Z",
    manifestId: "MAN-2025-0891"
  },
  {
    ticketId: "TKT-003",
    scaleNumber: "SCALE-02",
    truckPlate: "DEF-5678",
    grossWeightKg: 50150,
    tareWeightKg: 15000,
    netWeightKg: 35150,
    timestamp: "2025-09-10T10:00:00Z",
    manifestId: "MAN-2025-0891"
  }
];

fs.writeFileSync(path.join(dataDir, "manifests.json"), JSON.stringify(mockManifests, null, 2));
fs.writeFileSync(path.join(dataDir, "scale_tickets.json"), JSON.stringify(mockTickets, null, 2));

console.log("[OK] Generated synthetic manifests and scale tickets in data/");

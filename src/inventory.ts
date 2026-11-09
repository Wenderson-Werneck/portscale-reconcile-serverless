export type InventoryEventType = "PORT_RECEIPT" | "PROCESSING" | "DISPATCH_SALE";

export interface InventoryEvent {
  id: string;
  type: InventoryEventType;
  occurredAt: string;
  quantityKg: number;
  clientFacility?: string | null;
}

export interface InventoryLedgerState {
  rawPortStockKg: number;
  processedStockKg: number;
  dispatchedTotalKg: number;
}

export class IndustrialInventoryLedger {
  private state: InventoryLedgerState;

  constructor(initialState?: Partial<InventoryLedgerState>) {
    this.state = {
      rawPortStockKg: initialState?.rawPortStockKg ?? 0,
      processedStockKg: initialState?.processedStockKg ?? 0,
      dispatchedTotalKg: initialState?.dispatchedTotalKg ?? 0,
    };
  }

  public applyEvent(event: InventoryEvent): InventoryLedgerState {
    if (event.quantityKg <= 0) {
      throw new Error("INVALID_EVENT_QUANTITY: Must be positive non-zero value");
    }

    switch (event.type) {
      case "PORT_RECEIPT":
        this.state.rawPortStockKg += event.quantityKg;
        break;

      case "PROCESSING":
        if (this.state.rawPortStockKg < event.quantityKg) {
          throw new Error(`INSUFFICIENT_RAW_STOCK: Available ${this.state.rawPortStockKg} kg, requested ${event.quantityKg} kg`);
        }
        this.state.rawPortStockKg -= event.quantityKg;
        this.state.processedStockKg += event.quantityKg;
        break;

      case "DISPATCH_SALE":
        if (this.state.processedStockKg < event.quantityKg) {
          throw new Error(`INSUFFICIENT_PROCESSED_STOCK: Available ${this.state.processedStockKg} kg, requested ${event.quantityKg} kg`);
        }
        this.state.processedStockKg -= event.quantityKg;
        this.state.dispatchedTotalKg += event.quantityKg;
        break;

      default:
        throw new Error(`UNKNOWN_EVENT_TYPE: ${(event as any).type}`);
    }

    return this.getSnapshot();
  }

  public getSnapshot(): InventoryLedgerState {
    return { ...this.state };
  }
}

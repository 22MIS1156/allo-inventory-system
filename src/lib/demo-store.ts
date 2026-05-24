import { z } from "zod";

export type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED";

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  createdAt: string;
}

export interface Inventory {
  id: string;
  productId: string;
  warehouseId: string;
  totalStock: number;
  reservedStock: number;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAvailability extends Product {
  stockByWarehouse: Array<{
    warehouse: Warehouse;
    totalStock: number;
    reservedStock: number;
    availableStock: number;
  }>;
}

export interface ReservationDetails extends Reservation {
  product: Product;
  warehouse: Warehouse;
  inventorySnapshot: {
    totalStock: number;
    reservedStock: number;
    availableStock: number;
  };
}

export interface RaceSimulationResult {
  availableBefore: number;
  succeeded: string[];
  conflicted: string[];
  finalReservedStock: number;
}

export const reservationRequestSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  warehouseId: z.string().min(1, "Warehouse is required."),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .positive("Quantity must be greater than zero.")
    .max(25, "Demo reservations are capped at 25 units."),
});

export class DemoApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "DemoApiError";
  }
}

const nowIso = () => new Date().toISOString();
const reservationDurationMs = 10 * 60 * 1000;
const artificialDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const productSeed: Product[] = [
  {
    id: "prod-wireless-headset",
    name: "Aurora Wireless Headset",
    description: "Low-latency ANC headset for premium checkout and electronics demos.",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    createdAt: nowIso(),
  },
  {
    id: "prod-mechanical-keyboard",
    name: "Vertex Mechanical Keyboard",
    description: "Hot-swappable mechanical keyboard with tactile switches and RGB.",
    imageUrl: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80",
    createdAt: nowIso(),
  },
  {
    id: "prod-usb-dock",
    name: "Atlas USB-C Dock",
    description: "Compact multi-port dock for hybrid workstations and laptop setups.",
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80",
    createdAt: nowIso(),
  },
  {
    id: "prod-webcam",
    name: "Nimbus 4K Webcam",
    description: "4K webcam with HDR and AI framing for crisp video calls.",
    imageUrl: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=900&q=80",
    createdAt: nowIso(),
  },
];

const warehouseSeed: Warehouse[] = [
  {
    id: "wh-sydney",
    name: "Sydney Fulfilment Hub",
    location: "Sydney, AU",
    createdAt: nowIso(),
  },
  {
    id: "wh-singapore",
    name: "Singapore Regional DC",
    location: "Singapore, SG",
    createdAt: nowIso(),
  },
];

const inventorySeed: Inventory[] = [
  {
    id: "inv-1",
    productId: "prod-wireless-headset",
    warehouseId: "wh-sydney",
    totalStock: 8,
    reservedStock: 2,
    updatedAt: nowIso(),
  },
  {
    id: "inv-2",
    productId: "prod-wireless-headset",
    warehouseId: "wh-singapore",
    totalStock: 6,
    reservedStock: 1,
    updatedAt: nowIso(),
  },
  {
    id: "inv-3",
    productId: "prod-mechanical-keyboard",
    warehouseId: "wh-sydney",
    totalStock: 5,
    reservedStock: 1,
    updatedAt: nowIso(),
  },
  {
    id: "inv-4",
    productId: "prod-mechanical-keyboard",
    warehouseId: "wh-singapore",
    totalStock: 4,
    reservedStock: 0,
    updatedAt: nowIso(),
  },
  {
    id: "inv-5",
    productId: "prod-usb-dock",
    warehouseId: "wh-sydney",
    totalStock: 9,
    reservedStock: 3,
    updatedAt: nowIso(),
  },
  {
    id: "inv-6",
    productId: "prod-usb-dock",
    warehouseId: "wh-singapore",
    totalStock: 7,
    reservedStock: 2,
    updatedAt: nowIso(),
  },
  {
    id: "inv-7",
    productId: "prod-webcam",
    warehouseId: "wh-sydney",
    totalStock: 3,
    reservedStock: 1,
    updatedAt: nowIso(),
  },
  {
    id: "inv-8",
    productId: "prod-webcam",
    warehouseId: "wh-singapore",
    totalStock: 2,
    reservedStock: 1,
    updatedAt: nowIso(),
  },
];

const products = [...productSeed];
const warehouses = [...warehouseSeed];
const inventories = [...inventorySeed];
const reservations: Reservation[] = [];
let reservationCounter = 1;

const inventoryLocks = new Map<string, Promise<void>>();

function inventoryKey(productId: string, warehouseId: string) {
  return `${productId}:${warehouseId}`;
}

async function withInventoryLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const current = inventoryLocks.get(key) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const next = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  const chain = current.then(() => next);
  inventoryLocks.set(key, chain);

  await current;

  try {
    return await task();
  } finally {
    const finalize = release ?? (() => undefined);
    finalize();
    if (inventoryLocks.get(key) === chain) {
      inventoryLocks.delete(key);
    }
  }
}

function cloneProductAvailability(product: Product, stockByWarehouse: ProductAvailability["stockByWarehouse"]): ProductAvailability {
  return {
    ...product,
    stockByWarehouse: stockByWarehouse.map((stock) => ({
      warehouse: { ...stock.warehouse },
      totalStock: stock.totalStock,
      reservedStock: stock.reservedStock,
      availableStock: stock.availableStock,
    })),
  };
}

function releaseExpiredReservationsInternal(now = new Date()) {
  const nowTime = now.getTime();

  reservations.forEach((reservation) => {
    if (reservation.status !== "PENDING") {
      return;
    }

    if (new Date(reservation.expiresAt).getTime() > nowTime) {
      return;
    }

    const inventory = inventories.find(
      (entry) =>
        entry.productId === reservation.productId && entry.warehouseId === reservation.warehouseId,
    );

    if (inventory) {
      inventory.reservedStock = Math.max(0, inventory.reservedStock - reservation.quantity);
      inventory.updatedAt = nowIso();
    }

    reservation.status = "RELEASED";
    reservation.updatedAt = nowIso();
  });
}

function findInventory(productId: string, warehouseId: string) {
  return inventories.find(
    (entry) => entry.productId === productId && entry.warehouseId === warehouseId,
  );
}

function buildReservationDetails(reservation: Reservation): ReservationDetails {
  const product = products.find((entry) => entry.id === reservation.productId);
  const warehouse = warehouses.find((entry) => entry.id === reservation.warehouseId);
  const inventory = findInventory(reservation.productId, reservation.warehouseId);

  if (!product || !warehouse || !inventory) {
    throw new DemoApiError(500, "Reservation references missing product, warehouse, or inventory.");
  }

  return {
    ...reservation,
    product: { ...product },
    warehouse: { ...warehouse },
    inventorySnapshot: {
      totalStock: inventory.totalStock,
      reservedStock: inventory.reservedStock,
      availableStock: Math.max(0, inventory.totalStock - inventory.reservedStock),
    },
  };
}

export async function getProducts(): Promise<ProductAvailability[]> {
  releaseExpiredReservationsInternal();
  await artificialDelay(180);

  return products.map((product) => {
    const stockByWarehouse = inventories
      .filter((inventory) => inventory.productId === product.id)
      .map((inventory) => {
        const warehouse = warehouses.find((entry) => entry.id === inventory.warehouseId);

        if (!warehouse) {
          throw new DemoApiError(500, "Warehouse lookup failed while building product availability.");
        }

        return {
          warehouse,
          totalStock: inventory.totalStock,
          reservedStock: inventory.reservedStock,
          availableStock: Math.max(0, inventory.totalStock - inventory.reservedStock),
        };
      })
      .sort((left, right) => left.warehouse.name.localeCompare(right.warehouse.name));

    return cloneProductAvailability(product, stockByWarehouse);
  });
}

export async function getWarehouses(): Promise<Warehouse[]> {
  releaseExpiredReservationsInternal();
  await artificialDelay(120);
  return warehouses.map((warehouse) => ({ ...warehouse }));
}

export async function listReservations(): Promise<ReservationDetails[]> {
  releaseExpiredReservationsInternal();
  await artificialDelay(120);

  return reservations
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((reservation) => buildReservationDetails({ ...reservation }));
}

export async function getReservation(id: string): Promise<ReservationDetails | null> {
  releaseExpiredReservationsInternal();
  await artificialDelay(90);

  const reservation = reservations.find((entry) => entry.id === id);
  return reservation ? buildReservationDetails({ ...reservation }) : null;
}

export async function createReservation(input: unknown): Promise<ReservationDetails> {
  await artificialDelay(420);
  releaseExpiredReservationsInternal();

  const payload = reservationRequestSchema.parse(input);
  const product = products.find((entry) => entry.id === payload.productId);
  const warehouse = warehouses.find((entry) => entry.id === payload.warehouseId);

  if (!product || !warehouse) {
    throw new DemoApiError(404, "Product or warehouse could not be found.");
  }

  const key = inventoryKey(payload.productId, payload.warehouseId);

  return withInventoryLock(key, async () => {
    releaseExpiredReservationsInternal();

    const inventory = findInventory(payload.productId, payload.warehouseId);
    if (!inventory) {
      throw new DemoApiError(404, "Inventory record could not be found.");
    }

    const availableStock = inventory.totalStock - inventory.reservedStock;

    if (payload.quantity > availableStock) {
      throw new DemoApiError(
        409,
        "Not enough stock is available for this reservation.",
        `Requested ${payload.quantity}, but only ${Math.max(0, availableStock)} unit(s) remain.`,
      );
    }

    inventory.reservedStock += payload.quantity;
    inventory.updatedAt = nowIso();

    const timestamp = nowIso();
    const reservation: Reservation = {
      id: `res-${reservationCounter.toString().padStart(4, "0")}`,
      productId: payload.productId,
      warehouseId: payload.warehouseId,
      quantity: payload.quantity,
      status: "PENDING",
      expiresAt: new Date(Date.now() + reservationDurationMs).toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    reservationCounter += 1;
    reservations.unshift(reservation);

    return buildReservationDetails({ ...reservation });
  });
}

export async function confirmReservation(id: string): Promise<ReservationDetails> {
  await artificialDelay(320);
  releaseExpiredReservationsInternal();

  const existing = reservations.find((entry) => entry.id === id);
  if (!existing) {
    throw new DemoApiError(404, "Reservation not found.");
  }

  return withInventoryLock(inventoryKey(existing.productId, existing.warehouseId), async () => {
    releaseExpiredReservationsInternal();

    const reservation = reservations.find((entry) => entry.id === id);
    const inventory = reservation
      ? findInventory(reservation.productId, reservation.warehouseId)
      : null;

    if (!reservation || !inventory) {
      throw new DemoApiError(404, "Reservation could not be loaded for confirmation.");
    }

    if (reservation.status === "CONFIRMED") {
      return buildReservationDetails({ ...reservation });
    }

    if (reservation.status === "RELEASED") {
      if (new Date(reservation.expiresAt).getTime() <= Date.now()) {
        throw new DemoApiError(410, "This reservation already expired.");
      }

      throw new DemoApiError(409, "Released reservations cannot be confirmed.");
    }

    if (new Date(reservation.expiresAt).getTime() <= Date.now()) {
      reservation.status = "RELEASED";
      reservation.updatedAt = nowIso();
      throw new DemoApiError(410, "This reservation already expired.");
    }

    if (inventory.reservedStock < reservation.quantity || inventory.totalStock < reservation.quantity) {
      throw new DemoApiError(409, "Inventory state is inconsistent and cannot be confirmed.");
    }

    inventory.totalStock -= reservation.quantity;
    inventory.reservedStock -= reservation.quantity;
    inventory.updatedAt = nowIso();

    reservation.status = "CONFIRMED";
    reservation.updatedAt = nowIso();

    return buildReservationDetails({ ...reservation });
  });
}

export async function releaseReservation(id: string): Promise<ReservationDetails> {
  await artificialDelay(260);
  releaseExpiredReservationsInternal();

  const existing = reservations.find((entry) => entry.id === id);
  if (!existing) {
    throw new DemoApiError(404, "Reservation not found.");
  }

  return withInventoryLock(inventoryKey(existing.productId, existing.warehouseId), async () => {
    releaseExpiredReservationsInternal();

    const reservation = reservations.find((entry) => entry.id === id);
    const inventory = reservation
      ? findInventory(reservation.productId, reservation.warehouseId)
      : null;

    if (!reservation || !inventory) {
      throw new DemoApiError(404, "Reservation could not be loaded for release.");
    }

    if (reservation.status === "RELEASED") {
      return buildReservationDetails({ ...reservation });
    }

    if (reservation.status === "CONFIRMED") {
      throw new DemoApiError(409, "Confirmed reservations cannot be released.");
    }

    inventory.reservedStock = Math.max(0, inventory.reservedStock - reservation.quantity);
    inventory.updatedAt = nowIso();

    reservation.status = "RELEASED";
    reservation.updatedAt = nowIso();

    return buildReservationDetails({ ...reservation });
  });
}

export async function runFinalUnitRaceSimulation(): Promise<RaceSimulationResult> {
  await artificialDelay(180);

  const localLocks = new Map<string, Promise<void>>();
  const localInventory = {
    totalStock: 1,
    reservedStock: 0,
  };

  async function withLocalLock<T>(task: () => Promise<T>): Promise<T> {
    const current = localLocks.get("race") ?? Promise.resolve();
    let release: (() => void) | undefined;
    const next = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const chain = current.then(() => next);
    localLocks.set("race", chain);
    await current;

    try {
      return await task();
    } finally {
      const finalize = release ?? (() => undefined);
      finalize();
      if (localLocks.get("race") === chain) {
        localLocks.delete("race");
      }
    }
  }

  async function reserve(label: string) {
    return withLocalLock(async () => {
      await artificialDelay(100);
      const available = localInventory.totalStock - localInventory.reservedStock;
      if (available < 1) {
        throw new DemoApiError(409, `${label} received HTTP 409 conflict.`);
      }

      localInventory.reservedStock += 1;
      return `${label} reserved the final unit successfully.`;
    });
  }

  const [first, second] = await Promise.allSettled([reserve("Request A"), reserve("Request B")]);
  const outcomes = [first, second];

  return {
    availableBefore: 1,
    succeeded: outcomes
      .filter((outcome): outcome is PromiseFulfilledResult<string> => outcome.status === "fulfilled")
      .map((outcome) => outcome.value),
    conflicted: outcomes
      .filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected")
      .map((outcome) =>
        outcome.reason instanceof DemoApiError ? outcome.reason.message : "Unknown conflict",
      ),
    finalReservedStock: localInventory.reservedStock,
  };
}

export function getTimeRemaining(expiresAt: string) {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

export function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getStatusTone(status: ReservationStatus) {
  if (status === "CONFIRMED") {
    return "success" as const;
  }
  if (status === "RELEASED") {
    return "muted" as const;
  }
  return "warning" as const;
}

export const demoMetadata = {
  reservationDurationMs,
  apiRoutes: [
    "GET /api/products",
    "GET /api/warehouses",
    "POST /api/reservations",
    "POST /api/reservations/[id]/confirm",
    "POST /api/reservations/[id]/release",
  ],
  generatedFiles: [
    "prisma/schema.prisma",
    "prisma/seed.ts",
    "lib/reservations.ts",
    "app/api/products/route.ts",
    "app/api/warehouses/route.ts",
    "app/api/reservations/route.ts",
    "app/api/reservations/[id]/confirm/route.ts",
    "app/api/reservations/[id]/release/route.ts",
  ],
};

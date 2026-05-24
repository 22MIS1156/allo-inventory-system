import { Prisma, PrismaClient, ReservationStatus } from "@prisma/client";

export const RESERVATION_TTL_MINUTES = 10;

type ReservationScopedFilter = {
  productId: string;
  warehouseId: string;
};

type TransactionClient = Prisma.TransactionClient;

type ExpiredReservationRow = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
};

export class ReservationServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "ReservationServiceError";
  }
}

async function lockInventoryRow(
  tx: TransactionClient,
  productId: string,
  warehouseId: string,
) {
  await tx.$queryRaw(
    Prisma.sql`
      SELECT id
      FROM "Inventory"
      WHERE "productId" = ${productId}
        AND "warehouseId" = ${warehouseId}
      FOR UPDATE
    `,
  );

  const inventory = await tx.inventory.findUnique({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId,
      },
    },
  });

  if (!inventory) {
    throw new ReservationServiceError(404, "Inventory row not found.");
  }

  return inventory;
}

async function lockReservationRow(tx: TransactionClient, reservationId: string) {
  await tx.$queryRaw(
    Prisma.sql`
      SELECT id
      FROM "Reservation"
      WHERE id = ${reservationId}
      FOR UPDATE
    `,
  );

  return tx.reservation.findUnique({
    where: { id: reservationId },
  });
}

async function selectExpiredReservationsForUpdate(
  tx: TransactionClient,
  now: Date,
  scope?: ReservationScopedFilter,
) {
  const scopeSql = scope
    ? Prisma.sql`AND "productId" = ${scope.productId} AND "warehouseId" = ${scope.warehouseId}`
    : Prisma.empty;

  return tx.$queryRaw<ExpiredReservationRow[]>(
    Prisma.sql`
      SELECT id, "productId", "warehouseId", quantity
      FROM "Reservation"
      WHERE status = 'PENDING'
        AND "expiresAt" <= ${now}
        ${scopeSql}
      ORDER BY "productId" ASC, "warehouseId" ASC, id ASC
      FOR UPDATE
    `,
  );
}

export async function cleanupExpiredReservations(
  tx: TransactionClient,
  scope?: ReservationScopedFilter,
) {
  const now = new Date();
  const expiredReservations = await selectExpiredReservationsForUpdate(tx, now, scope);

  if (expiredReservations.length === 0) {
    return { releasedCount: 0 };
  }

  const grouped = new Map<string, ReservationScopedFilter & { quantity: number }>();

  for (const reservation of expiredReservations) {
    const key = `${reservation.productId}:${reservation.warehouseId}`;
    const current = grouped.get(key);

    if (current) {
      current.quantity += reservation.quantity;
      continue;
    }

    grouped.set(key, {
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      quantity: reservation.quantity,
    });
  }

  const sortedGroups = [...grouped.values()].sort((left, right) => {
    const leftKey = `${left.productId}:${left.warehouseId}`;
    const rightKey = `${right.productId}:${right.warehouseId}`;
    return leftKey.localeCompare(rightKey);
  });

  for (const group of sortedGroups) {
    const inventory = await lockInventoryRow(tx, group.productId, group.warehouseId);
    const decrementBy = Math.min(group.quantity, inventory.reservedStock);

    if (decrementBy > 0) {
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: {
            decrement: decrementBy,
          },
          updatedAt: now,
        },
      });
    }
  }

  await tx.reservation.updateMany({
    where: {
      id: {
        in: expiredReservations.map((reservation) => reservation.id),
      },
      status: ReservationStatus.PENDING,
    },
    data: {
      status: ReservationStatus.RELEASED,
      updatedAt: now,
    },
  });

  return {
    releasedCount: expiredReservations.length,
  };
}

export async function getProductsWithAvailability(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    await cleanupExpiredReservations(tx);

    const products = await tx.product.findMany({
      include: {
        inventories: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      createdAt: product.createdAt,
      warehouses: product.inventories
        .slice()
        .sort((left, right) => left.warehouse.name.localeCompare(right.warehouse.name))
        .map((inventory) => ({
          warehouseId: inventory.warehouseId,
          warehouseName: inventory.warehouse.name,
          warehouseLocation: inventory.warehouse.location,
          totalStock: inventory.totalStock,
          reservedStock: inventory.reservedStock,
          availableStock: Math.max(0, inventory.totalStock - inventory.reservedStock),
        })),
    }));
  });
}

export async function createReservation(
  prisma: PrismaClient,
  input: { productId: string; warehouseId: string; quantity: number },
) {
  return prisma.$transaction(async (tx) => {
    // Concurrency-critical section:
    // 1) lock the inventory row,
    // 2) release any expired reservations touching the same row,
    // 3) recompute available stock,
    // 4) reserve or fail with HTTP 409.
    await lockInventoryRow(tx, input.productId, input.warehouseId);
    await cleanupExpiredReservations(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
    });

    const inventory = await tx.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
    });

    if (!inventory) {
      throw new ReservationServiceError(404, "Inventory row not found.");
    }

    const available = inventory.totalStock - inventory.reservedStock;
    if (available < input.quantity) {
      throw new ReservationServiceError(
        409,
        "Insufficient stock for reservation.",
        `Requested ${input.quantity}, available ${Math.max(0, available)}.`,
      );
    }

    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        reservedStock: {
          increment: input.quantity,
        },
      },
    });

    return tx.reservation.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        status: ReservationStatus.PENDING,
        expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000),
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
  });
}

export async function confirmReservation(prisma: PrismaClient, reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const reservation = await lockReservationRow(tx, reservationId);

    if (!reservation) {
      throw new ReservationServiceError(404, "Reservation not found.");
    }

    const inventory = await lockInventoryRow(tx, reservation.productId, reservation.warehouseId);

    if (reservation.status === ReservationStatus.CONFIRMED) {
      return tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: {
          product: true,
          warehouse: true,
        },
      });
    }

    if (reservation.expiresAt <= now) {
      if (reservation.status === ReservationStatus.PENDING) {
        const decrementBy = Math.min(reservation.quantity, inventory.reservedStock);
        if (decrementBy > 0) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              reservedStock: {
                decrement: decrementBy,
              },
              updatedAt: now,
            },
          });
        }

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.RELEASED,
            updatedAt: now,
          },
        });
      }

      throw new ReservationServiceError(410, "Reservation expired.");
    }

    if (reservation.status === ReservationStatus.RELEASED) {
      throw new ReservationServiceError(409, "Released reservations cannot be confirmed.");
    }

    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        totalStock: {
          decrement: reservation.quantity,
        },
        reservedStock: {
          decrement: reservation.quantity,
        },
        updatedAt: now,
      },
    });

    return tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        updatedAt: now,
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
  });
}

export async function releaseReservation(prisma: PrismaClient, reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const reservation = await lockReservationRow(tx, reservationId);

    if (!reservation) {
      throw new ReservationServiceError(404, "Reservation not found.");
    }

    const inventory = await lockInventoryRow(tx, reservation.productId, reservation.warehouseId);

    if (reservation.status === ReservationStatus.RELEASED) {
      return tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: {
          product: true,
          warehouse: true,
        },
      });
    }

    if (reservation.status === ReservationStatus.CONFIRMED) {
      throw new ReservationServiceError(409, "Confirmed reservations cannot be released.");
    }

    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        reservedStock: {
          decrement: reservation.quantity,
        },
        updatedAt: now,
      },
    });

    return tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.RELEASED,
        updatedAt: now,
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
  });
}

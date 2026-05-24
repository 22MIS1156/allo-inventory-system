import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredReservations, ReservationServiceError } from "@/lib/reservations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const warehouses = await prisma.$transaction(async (tx) => {
      await cleanupExpiredReservations(tx);
      return tx.warehouse.findMany({
        orderBy: {
          createdAt: "asc",
        },
      });
    });

    return NextResponse.json({ data: warehouses });
  } catch (error) {
    if (error instanceof ReservationServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    console.error(error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProductsWithAvailability, ReservationServiceError } from "@/lib/reservations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getProductsWithAvailability(prisma);
    return NextResponse.json({ data: products });
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

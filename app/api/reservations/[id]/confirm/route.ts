import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmReservation, ReservationServiceError } from "@/lib/reservations";
import { reservationIdParamsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = reservationIdParamsSchema.parse(await context.params);
    const reservation = await confirmReservation(prisma, params.id);
    return NextResponse.json({ data: reservation });
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

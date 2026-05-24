import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readIdempotencyRecord, writeIdempotencyRecord } from "@/lib/redis";
import { createReservation, ReservationServiceError } from "@/lib/reservations";
import { reservationRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  let fingerprint: string | null = null;

  try {
    const json = await request.json();
    const payload = reservationRequestSchema.parse(json);
    fingerprint = JSON.stringify(payload);

    if (idempotencyKey && fingerprint) {
      const cached = await readIdempotencyRecord(idempotencyKey, fingerprint);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status });
      }
    }

    const reservation = await createReservation(prisma, payload);
    const body = { data: reservation };

    if (idempotencyKey && fingerprint) {
      await writeIdempotencyRecord(idempotencyKey, {
        fingerprint,
        status: 201,
        body,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof ReservationServiceError) {
      const body = {
        error: error.message,
        details: error.details,
      };

      if (idempotencyKey && fingerprint) {
        await writeIdempotencyRecord(idempotencyKey, {
          fingerprint,
          status: error.statusCode,
          body,
          createdAt: new Date().toISOString(),
        });
      }

      return NextResponse.json(body, { status: error.statusCode });
    }

    console.error(error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

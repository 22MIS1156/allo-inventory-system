import { z } from "zod";

export const reservationRequestSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  warehouseId: z.string().min(1, "warehouseId is required"),
  quantity: z.coerce.number().int().positive().max(100),
});

export const reservationIdParamsSchema = z.object({
  id: z.string().min(1, "Reservation id is required"),
});

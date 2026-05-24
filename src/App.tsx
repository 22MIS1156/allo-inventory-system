import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  LoaderCircle,
  LockKeyhole,
  Package2,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Warehouse as WarehouseIcon,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DemoApiError,
  createReservation,
  confirmReservation,
  demoMetadata,
  formatCountdown,
  getProducts,
  getReservation,
  getStatusTone,
  getTimeRemaining,
  getWarehouses,
  listReservations,
  releaseReservation,
  reservationRequestSchema,
  runFinalUnitRaceSimulation,
  type ProductAvailability,
  type RaceSimulationResult,
  type ReservationDetails,
} from "@/lib/demo-store";
import { cn } from "@/utils/cn";

type NoticeTone = "success" | "error" | "info";

interface AppNotice {
  tone: NoticeTone;
  title: string;
  body: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof DemoApiError) {
    return error.details ? `${error.message} ${error.details}` : error.message;
  }

  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something unexpected happened.";
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <Badge tone="info">{eyebrow}</Badge>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{description}</p>
      </div>
    </div>
  );
}

function NoticeBanner({ notice }: { notice: AppNotice }) {
  const palette: Record<NoticeTone, string> = {
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    error: "border-rose-400/20 bg-rose-400/10 text-rose-100",
    info: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
  };

  const Icon = notice.tone === "success" ? CheckCircle2 : notice.tone === "error" ? XCircle : ShieldCheck;

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3", palette[notice.tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">{notice.title}</p>
        <p className="text-sm opacity-90">{notice.body}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
        <div className="flex items-center justify-between">
          <div className="rounded-2xl border border-white/10 bg-white/8 p-3 text-cyan-200">{icon}</div>
          <Badge tone="muted">Live demo</Badge>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-3xl font-semibold text-white">{value}</p>
          <p className="text-sm text-slate-300">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReservationStatusBadge({ status }: { status: ReservationDetails["status"] }) {
  return <Badge tone={getStatusTone(status)}>{status}</Badge>;
}

function ProductCard({
  product,
  onReserved,
  pushNotice,
}: {
  product: ProductAvailability;
  onReserved: (reservationId: string) => void;
  pushNotice: (notice: AppNotice) => void;
}) {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState(product.stockByWarehouse[0]?.warehouse.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!product.stockByWarehouse.some((entry) => entry.warehouse.id === warehouseId)) {
      setWarehouseId(product.stockByWarehouse[0]?.warehouse.id ?? "");
    }
  }, [product.stockByWarehouse, warehouseId]);

  const selectedWarehouse =
    product.stockByWarehouse.find((entry) => entry.warehouse.id === warehouseId) ?? product.stockByWarehouse[0];

  const reserveMutation = useMutation({
    mutationFn: async () => {
      const parsed = reservationRequestSchema.parse({
        productId: product.id,
        warehouseId,
        quantity,
      });

      return createReservation(parsed);
    },
    onSuccess: async (reservation) => {
      setLocalError(null);
      pushNotice({
        tone: "success",
        title: "Reservation created",
        body: `${reservation.quantity} unit(s) reserved at ${reservation.warehouse.name}.`,
      });
      onReserved(reservation.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["reservations"] }),
      ]);
    },
    onError: (error) => {
      setLocalError(getErrorMessage(error));
      pushNotice({
        tone: "error",
        title: "Reservation failed",
        body: getErrorMessage(error),
      });
    },
  });

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="relative min-h-64 overflow-hidden border-b border-white/10 lg:border-r lg:border-b-0">
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
          <div className="absolute left-5 top-5 flex items-center gap-2">
            <Badge tone="info">Product</Badge>
            <Badge tone="muted">{product.stockByWarehouse.length} warehouses</Badge>
          </div>
          <div className="absolute inset-x-5 bottom-5 space-y-2">
            <p className="text-2xl font-semibold text-white">{product.name}</p>
            <p className="max-w-md text-sm leading-6 text-slate-200">{product.description}</p>
          </div>
        </div>

        <CardContent className="space-y-5 p-6">
          <div className="grid gap-3">
            {product.stockByWarehouse.map((stock) => {
              const pressure = stock.totalStock > 0 ? (stock.reservedStock / stock.totalStock) * 100 : 0;
              const isSelected = stock.warehouse.id === warehouseId;

              return (
                <button
                  key={stock.warehouse.id}
                  type="button"
                  onClick={() => setWarehouseId(stock.warehouse.id)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    isSelected
                      ? "border-cyan-400/40 bg-cyan-400/10 shadow-lg shadow-cyan-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/8",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{stock.warehouse.name}</p>
                      <p className="text-sm text-slate-400">{stock.warehouse.location}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge tone={stock.availableStock > 0 ? "success" : "warning"}>
                        {stock.availableStock} available
                      </Badge>
                      <Badge tone="muted">{stock.reservedStock} reserved</Badge>
                      <Badge tone="default">{stock.totalStock} total</Badge>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pressure > 65 ? "bg-amber-300" : "bg-cyan-300",
                      )}
                      style={{ width: `${Math.min(100, Math.max(10, pressure))}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                Reserve from warehouse
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none ring-0 transition focus:border-cyan-400/40"
                >
                  {product.stockByWarehouse.map((stock) => (
                    <option key={stock.warehouse.id} value={stock.warehouse.id} className="bg-slate-950">
                      {stock.warehouse.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                Quantity
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, selectedWarehouse?.availableStock ?? 1)}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none ring-0 transition focus:border-cyan-400/40"
                />
              </label>
            </div>

            <Button
              size="lg"
              className="w-full md:w-auto"
              disabled={reserveMutation.isPending || !selectedWarehouse || selectedWarehouse.availableStock === 0}
              onClick={() => reserveMutation.mutate()}
            >
              {reserveMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Reserving...
                </>
              ) : (
                <>
                  Reserve stock <ShoppingCart className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {selectedWarehouse ? (
            <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Available now</p>
                <p className="mt-1 text-lg font-semibold text-white">{selectedWarehouse.availableStock}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Reserved in queue</p>
                <p className="mt-1 text-lg font-semibold text-white">{selectedWarehouse.reservedStock}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Inventory total</p>
                <p className="mt-1 text-lg font-semibold text-white">{selectedWarehouse.totalStock}</p>
              </div>
            </div>
          ) : null}

          {localError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {localError}
            </div>
          ) : null}
        </CardContent>
      </div>
    </Card>
  );
}

function ReservationPanel({
  reservation,
  loading,
  pushNotice,
  onRefresh,
}: {
  reservation: ReservationDetails | null | undefined;
  loading: boolean;
  pushNotice: (notice: AppNotice) => void;
  onRefresh: () => Promise<void>;
}) {
  const countdown = reservation ? formatCountdown(getTimeRemaining(reservation.expiresAt)) : "10:00";

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!reservation) {
        throw new Error("Select a reservation before confirming.");
      }

      return confirmReservation(reservation.id);
    },
    onSuccess: async () => {
      pushNotice({
        tone: "success",
        title: "Purchase confirmed",
        body: "Reserved inventory moved into a completed order state.",
      });
      await onRefresh();
    },
    onError: (error) => {
      pushNotice({
        tone: "error",
        title: "Confirmation failed",
        body: getErrorMessage(error),
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      if (!reservation) {
        throw new Error("Select a reservation before releasing.");
      }

      return releaseReservation(reservation.id);
    },
    onSuccess: async () => {
      pushNotice({
        tone: "info",
        title: "Reservation released",
        body: "Reserved units were returned to available inventory.",
      });
      await onRefresh();
    },
    onError: (error) => {
      pushNotice({
        tone: "error",
        title: "Release failed",
        body: getErrorMessage(error),
      });
    },
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-80 items-center justify-center p-8 text-slate-300">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 animate-spin" /> Loading reservation details...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reservation) {
    return (
      <Card>
        <CardContent className="flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-cyan-200">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">No active checkout selected</h3>
            <p className="max-w-md text-sm leading-6 text-slate-300">
              Reserve any product from the catalog to open a 10 minute checkout window with confirm and cancel actions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{reservation.product.name}</CardTitle>
            <CardDescription>
              Reservation {reservation.id} • {reservation.warehouse.name}
            </CardDescription>
          </div>
          <ReservationStatusBadge status={reservation.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Checkout timer</p>
            <div className="mt-2 flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-cyan-200" />
              <span className="text-3xl font-semibold tracking-tight text-white">{countdown}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Pending reservations expire automatically unless they are confirmed before the deadline.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Inventory snapshot</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-950/70 p-3">
                <p className="text-slate-400">Reserved</p>
                <p className="mt-1 text-lg font-semibold text-white">{reservation.quantity}</p>
              </div>
              <div className="rounded-2xl bg-slate-950/70 p-3">
                <p className="text-slate-400">Available</p>
                <p className="mt-1 text-lg font-semibold text-white">{reservation.inventorySnapshot.availableStock}</p>
              </div>
              <div className="rounded-2xl bg-slate-950/70 p-3">
                <p className="text-slate-400">On hand</p>
                <p className="mt-1 text-lg font-semibold text-white">{reservation.inventorySnapshot.totalStock}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300 md:grid-cols-2">
          <div>
            <p className="text-slate-400">Created</p>
            <p className="mt-1 text-white">{new Date(reservation.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-400">Expires</p>
            <p className="mt-1 text-white">{new Date(reservation.expiresAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            disabled={confirmMutation.isPending || releaseMutation.isPending || reservation.status !== "PENDING"}
            onClick={() => confirmMutation.mutate()}
          >
            {confirmMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" /> Confirming...
              </>
            ) : (
              <>
                Confirm purchase <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={confirmMutation.isPending || releaseMutation.isPending || reservation.status !== "PENDING"}
            onClick={() => releaseMutation.mutate()}
          >
            {releaseMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" /> Releasing...
              </>
            ) : (
              <>
                Cancel reservation <XCircle className="h-4 w-4" />
              </>
            )}
          </Button>
          <Button size="lg" variant="ghost" onClick={() => void onRefresh()}>
            <RefreshCcw className="h-4 w-4" /> Refresh state
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RaceSimulationCard({
  result,
  run,
  running,
}: {
  result: RaceSimulationResult | null;
  run: () => void;
  running: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <Badge tone="warning">Concurrency proof</Badge>
        <CardTitle>Final-unit race simulation</CardTitle>
        <CardDescription>
          Two requests attempt to reserve the same final unit at the same time. A per-row lock serializes access so only one request can win.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Available before</p>
            <p className="mt-1 text-2xl font-semibold text-white">1</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Required outcome</p>
            <p className="mt-1 text-lg font-semibold text-white">1 success / 1 conflict</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Lock style</p>
            <p className="mt-1 text-lg font-semibold text-white">SELECT ... FOR UPDATE</p>
          </div>
        </div>

        <Button size="lg" variant="secondary" onClick={run} disabled={running}>
          {running ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Running race...
            </>
          ) : (
            <>
              Run simulation <LockKeyhole className="h-4 w-4" />
            </>
          )}
        </Button>

        {result ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-sm font-medium text-emerald-100">Successful request</p>
              <ul className="mt-3 space-y-2 text-sm text-emerald-50">
                {result.succeeded.map((entry) => (
                  <li key={entry}>• {entry}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
              <p className="text-sm font-medium text-rose-100">Conflicted request</p>
              <ul className="mt-3 space-y-2 text-sm text-rose-50">
                {result.conflicted.map((entry) => (
                  <li key={entry}>• {entry}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const [activeReservationId, setActiveReservationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<AppNotice>({
    tone: "info",
    title: "Project preview ready",
    body: "This interactive build demonstrates the reservation flow and includes generated Next.js, Prisma, and API blueprint files in the repository.",
  });

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    refetchOnWindowFocus: false,
    refetchInterval: 10000,
  });
  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
    refetchOnWindowFocus: false,
  });
  const reservationsQuery = useQuery({
    queryKey: ["reservations"],
    queryFn: listReservations,
    refetchOnWindowFocus: false,
    refetchInterval: 1000,
  });
  const activeReservationQuery = useQuery({
    queryKey: ["reservation", activeReservationId],
    queryFn: () => getReservation(activeReservationId ?? ""),
    enabled: Boolean(activeReservationId),
    refetchOnWindowFocus: false,
    refetchInterval: activeReservationId ? 1000 : false,
  });

  const raceMutation = useMutation({
    mutationFn: runFinalUnitRaceSimulation,
    onSuccess: () => {
      setNotice({
        tone: "success",
        title: "Race condition check passed",
        body: "Exactly one request succeeded and the competing request returned a 409-style conflict in the simulation.",
      });
    },
  });

  useEffect(() => {
    if (!activeReservationId && reservationsQuery.data?.length) {
      setActiveReservationId(reservationsQuery.data[0].id);
    }
  }, [activeReservationId, reservationsQuery.data]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["reservations"] }),
      queryClient.invalidateQueries({ queryKey: ["reservation", activeReservationId] }),
    ]);
  };

  const metrics = useMemo(() => {
    const products = productsQuery.data ?? [];
    const warehouses = warehousesQuery.data ?? [];
    const reservations = reservationsQuery.data ?? [];
    const pendingReservations = reservations.filter((entry) => entry.status === "PENDING").length;
    const availableUnits = products.reduce(
      (total, product) =>
        total + product.stockByWarehouse.reduce((sum, stock) => sum + stock.availableStock, 0),
      0,
    );

    return {
      productCount: products.length,
      warehouseCount: warehouses.length,
      pendingReservations,
      availableUnits,
    };
  }, [productsQuery.data, reservationsQuery.data, warehousesQuery.data]);

  const loading = productsQuery.isLoading || warehousesQuery.isLoading || reservationsQuery.isLoading;
  const activeReservation = activeReservationQuery.data ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[34rem]" />

      <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
              <Package2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">ReserveFlow Commerce</p>
              <p className="text-xs text-slate-400">Concurrency-safe inventory hold system</p>
            </div>
          </div>

          <nav className="hidden items-center gap-5 text-sm text-slate-300 md:flex">
            <a href="#catalog" className="transition hover:text-white">
              Catalog
            </a>
            <a href="#checkout" className="transition hover:text-white">
              Checkout
            </a>
            <a href="#concurrency" className="transition hover:text-white">
              Concurrency
            </a>
            <a href="#architecture" className="transition hover:text-white">
              Architecture
            </a>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10 lg:px-8 lg:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
          <div className="space-y-6">
            <Badge tone="info">Next.js + Prisma architecture preview</Badge>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Inventory reservations that stay correct even when checkout traffic spikes.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                This app visualizes a race-condition-safe reservation workflow, shows warehouse-level availability, and documents the generated App Router + Prisma backend blueprint for production deployment on Vercel.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>
                Explore products <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById("concurrency")?.scrollIntoView({ behavior: "smooth" })}
              >
                Review locking strategy <LockKeyhole className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border-cyan-400/15 bg-gradient-to-br from-cyan-400/10 via-slate-900/80 to-violet-500/10">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <Badge tone="warning">Production checklist</Badge>
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
              </div>
              <div className="grid gap-3">
                {[
                  "Row-level inventory locking with SELECT ... FOR UPDATE",
                  "HTTP 409 on insufficient stock under concurrent checkout",
                  "Automatic reservation expiry with lazy cleanup and cron support",
                  "Idempotent confirm/release semantics and optional Redis caching",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {notice ? <NoticeBanner notice={notice} /> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Package2 className="h-5 w-5" />}
            label="Seeded products"
            value={String(metrics.productCount)}
            caption="Four launch items across two fulfillment locations."
          />
          <MetricCard
            icon={<WarehouseIcon className="h-5 w-5" />}
            label="Warehouses"
            value={String(metrics.warehouseCount)}
            caption="Availability is grouped by warehouse for checkout selection."
          />
          <MetricCard
            icon={<Clock3 className="h-5 w-5" />}
            label="Pending reservations"
            value={String(metrics.pendingReservations)}
            caption="Reservations remain active until confirmation or expiry."
          />
          <MetricCard
            icon={<DatabaseZap className="h-5 w-5" />}
            label="Available units"
            value={String(metrics.availableUnits)}
            caption="Live stock is recalculated after each reserve, confirm, or release action."
          />
        </section>

        <section id="catalog" className="space-y-6">
          <SectionHeading
            eyebrow="Product listing page"
            title="Reserve inventory directly from warehouse-level stock views"
            description="The listing below acts like a checkout step: customers choose a warehouse, request a quantity, and create a temporary reservation that immediately updates available stock across the interface."
          />

          {loading ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-slate-300">
                <LoaderCircle className="h-5 w-5 animate-spin" /> Loading catalog and inventory snapshots...
              </CardContent>
            </Card>
          ) : null}

          {productsQuery.error ? (
            <NoticeBanner
              notice={{
                tone: "error",
                title: "Could not load products",
                body: getErrorMessage(productsQuery.error),
              }}
            />
          ) : null}

          <div className="grid gap-6">
            {(productsQuery.data ?? []).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onReserved={(reservationId) => setActiveReservationId(reservationId)}
                pushNotice={setNotice}
              />
            ))}
          </div>
        </section>

        <section id="checkout" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <SectionHeading
              eyebrow="Reservation / checkout page"
              title="Confirm or release held stock before the timer expires"
              description="The reservation panel mirrors the App Router checkout page requirements: visible timer, idempotent actions, clear 409 and 410 handling, and automatic refresh after every mutation."
            />
            <ReservationPanel
              reservation={activeReservation}
              loading={activeReservationQuery.isLoading}
              pushNotice={setNotice}
              onRefresh={refreshAll}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reservation history</CardTitle>
              <CardDescription>
                Click any reservation to inspect its countdown, status, and inventory impact.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(reservationsQuery.data ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  No reservations yet. Reserve stock from the catalog to open a checkout session.
                </div>
              ) : (
                (reservationsQuery.data ?? []).map((reservation) => {
                  const isActive = activeReservationId === reservation.id;
                  return (
                    <button
                      key={reservation.id}
                      type="button"
                      onClick={() => setActiveReservationId(reservation.id)}
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition",
                        isActive
                          ? "border-cyan-400/35 bg-cyan-400/10 shadow-lg shadow-cyan-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/8",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{reservation.product.name}</p>
                          <p className="text-sm text-slate-400">
                            {reservation.quantity} unit(s) • {reservation.warehouse.location}
                          </p>
                        </div>
                        <ReservationStatusBadge status={reservation.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                        <span>{new Date(reservation.createdAt).toLocaleTimeString()}</span>
                        <span>{reservation.status === "PENDING" ? formatCountdown(getTimeRemaining(reservation.expiresAt)) : reservation.status}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>

        <section id="concurrency" className="space-y-6">
          <SectionHeading
            eyebrow="Concurrency requirement"
            title="The final unit can only be reserved once"
            description="The generated backend uses PostgreSQL transactions and row locks on inventory rows so overlapping requests serialize correctly. This interactive simulation demonstrates the same invariant in the preview experience."
          />
          <RaceSimulationCard
            result={raceMutation.data ?? null}
            run={() => raceMutation.mutate()}
            running={raceMutation.isPending}
          />
        </section>

        <section id="architecture" className="space-y-6">
          <SectionHeading
            eyebrow="Generated project blueprint"
            title="Repository outputs for the production Next.js implementation"
            description="Alongside this preview UI, the repository now includes Prisma schema definitions, seed data, transaction-safe reservation services, and App Router API handlers that match the requested contract."
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>API surface</CardTitle>
                <CardDescription>Implemented route handlers for inventory reads and reservation mutations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {demoMetadata.apiRoutes.map((route) => (
                  <div key={route} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-slate-200">
                    {route}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generated files</CardTitle>
                <CardDescription>Key backend and data-model files created for engineering review.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {demoMetadata.generatedFiles.map((file) => (
                  <div key={file} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-slate-200">
                    {file}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Concurrency strategy</CardTitle>
                <CardDescription>Lock the inventory row inside a transaction before calculating availability.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
                <p>1. Start a Prisma interactive transaction.</p>
                <p>2. Execute SELECT ... FOR UPDATE on the matching inventory row.</p>
                <p>3. Release expired pending reservations for that same row.</p>
                <p>4. Recompute available stock and either reserve or return HTTP 409.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expiry handling</CardTitle>
                <CardDescription>Pending reservations expire after 10 minutes unless confirmed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
                <p>• Lazy cleanup runs before reads and writes.</p>
                <p>• Released reservations decrement reservedStock safely.</p>
                <p>• README documents optional Vercel Cron hardening for scheduled cleanup.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deployment target</CardTitle>
                <CardDescription>Hosted PostgreSQL, optional Upstash Redis, and Vercel-compatible route handlers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
                <p>• Neon / Supabase PostgreSQL compatible datasource settings.</p>
                <p>• Prisma schema ready for migrate deploy.</p>
                <p>• Environment variables documented in README and .env.example.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>ReserveFlow Commerce preview • Tailwind UI front-end + generated Next.js / Prisma backend blueprint.</p>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <span>Run the generated Next.js sources separately for full API deployment.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  await prisma.product.createMany({
    data: [
      {
        id: "prod-wireless-headset",
        name: "Aurora Wireless Headset",
        description: "Low-latency ANC headset for premium checkout and electronics demos.",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "prod-mechanical-keyboard",
        name: "Vertex Mechanical Keyboard",
        description: "Hot-swappable mechanical keyboard with tactile switches and RGB.",
        imageUrl: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "prod-usb-dock",
        name: "Atlas USB-C Dock",
        description: "Compact multi-port dock for hybrid workstations and laptop setups.",
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "prod-webcam",
        name: "Nimbus 4K Webcam",
        description: "4K webcam with HDR and AI framing for crisp video calls.",
        imageUrl: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=900&q=80",
      },
    ],
  });

  await prisma.warehouse.createMany({
    data: [
      {
        id: "wh-sydney",
        name: "Sydney Fulfilment Hub",
        location: "Sydney, AU",
      },
      {
        id: "wh-singapore",
        name: "Singapore Regional DC",
        location: "Singapore, SG",
      },
    ],
  });

  await prisma.inventory.createMany({
    data: [
      {
        productId: "prod-wireless-headset",
        warehouseId: "wh-sydney",
        totalStock: 8,
        reservedStock: 2,
      },
      {
        productId: "prod-wireless-headset",
        warehouseId: "wh-singapore",
        totalStock: 6,
        reservedStock: 1,
      },
      {
        productId: "prod-mechanical-keyboard",
        warehouseId: "wh-sydney",
        totalStock: 5,
        reservedStock: 1,
      },
      {
        productId: "prod-mechanical-keyboard",
        warehouseId: "wh-singapore",
        totalStock: 4,
        reservedStock: 0,
      },
      {
        productId: "prod-usb-dock",
        warehouseId: "wh-sydney",
        totalStock: 9,
        reservedStock: 3,
      },
      {
        productId: "prod-usb-dock",
        warehouseId: "wh-singapore",
        totalStock: 7,
        reservedStock: 2,
      },
      {
        productId: "prod-webcam",
        warehouseId: "wh-sydney",
        totalStock: 3,
        reservedStock: 1,
      },
      {
        productId: "prod-webcam",
        warehouseId: "wh-singapore",
        totalStock: 2,
        reservedStock: 1,
      },
    ],
  });

  console.log("Seed complete: 4 products, 2 warehouses, and inventory distribution inserted.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

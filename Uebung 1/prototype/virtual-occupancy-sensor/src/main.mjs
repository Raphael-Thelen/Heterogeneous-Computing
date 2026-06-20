import "@matter/nodejs";
import http from "node:http";
import { ServerNode } from "@matter/main";
import { OccupancySensingServer } from "@matter/main/behaviors";
import { OccupancySensing } from "@matter/main/clusters/occupancy-sensing";
import { OccupancySensorDevice } from "@matter/main/devices/occupancy-sensor";

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeId = process.env.MATTER_NODE_ID ?? "virtual-occupancy-sensor-1";
const deviceName = process.env.MATTER_DEVICE_NAME ?? "Virtual Motion Sensor 1";
const vendorName = process.env.MATTER_VENDOR_NAME ?? "HC Demo";
const productName = process.env.MATTER_PRODUCT_NAME ?? "Virtual Motion Sensor";
const passcode = parseNumber(process.env.MATTER_PASSCODE, 20202024);
const discriminator = parseNumber(process.env.MATTER_DISCRIMINATOR, 3843);
const port = parseNumber(process.env.MATTER_PORT, 5543);
const statusHttpPort = parseNumber(process.env.MATTER_STATUS_HTTP_PORT, 8093);
const clearAfterMs = parseNumber(process.env.MOTION_CLEAR_MS, 3500);

let occupied = false;
let clearTimer;
let sensor;

const setOccupied = async next => {
  occupied = next;
  await sensor.set({
    occupancySensing: {
      occupancy: {
        occupied: next,
      },
    },
  });
  console.log(`[virtual-occupancy-sensor] occupancy -> ${next ? "MOTION" : "CLEAR"}`);
};

const triggerMotion = async () => {
  if (!occupied) {
    await setOccupied(true);
  }

  if (clearTimer) {
    clearTimeout(clearTimer);
  }

  clearTimer = setTimeout(() => {
    setOccupied(false).catch(error => {
      console.error("[virtual-occupancy-sensor] clear failed", error);
    });
  }, clearAfterMs);
};

const renderStatusPage = () => `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${deviceName}</title>
    <style>
       html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        font-family: "Segoe UI", Tahoma, sans-serif;
      }

      div {
        position: absolute;
        bottom: 0;
        left: 0;
        padding: 12px 16px;
        background: white;
        border-radius: 0 8px 0 0;
        opacity: 0.2;
      }

      body {
        background: ${occupied ? "#94ffeb" : "#cfd7e6"};
        transition: background 220ms ease;
      }
    </style>
  </head>
  <body>
   <div>${deviceName}</div>
    <script>
      let lastTrigger = 0;

      const applyState = payload => {
        document.body.style.background = payload.occupied ? "#94ffeb" : "#cfd7e6";
      };

      const syncState = async () => {
        const response = await fetch("/state", { cache: "no-store" });
        if (!response.ok) return;
        applyState(await response.json());
      };

      const triggerMotion = async () => {
        const now = Date.now();
        if (now - lastTrigger < 350) return;
        lastTrigger = now;
        await fetch("/motion", { method: "POST" });
      };

      window.addEventListener("mousemove", () => {
        triggerMotion().catch(() => {});
      }, { passive: true });

      setInterval(() => syncState().catch(() => {}), 700);
      syncState().catch(() => {});
    </script>
  </body>
</html>`;

const statusServer = http.createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad Request");
    return;
  }

  if (request.url === "/state") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({
      occupied,
      deviceName,
      nodeId,
      updatedAt: new Date().toISOString(),
    }));
    return;
  }

  if (request.url === "/motion" && request.method === "POST") {
    triggerMotion()
      .then(() => {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, occupied }));
      })
      .catch(error => {
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false, error: String(error) }));
      });
    return;
  }

  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("ok");
    return;
  }

  if (request.url === "/" || request.url === "/index.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(renderStatusPage());
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
});

const MotionSensorDevice = OccupancySensorDevice.with(
  OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared),
);

const node = await ServerNode.create({
  id: nodeId,
  network: { port },
  commissioning: { passcode, discriminator },
  productDescription: { name: deviceName, vendorName, productName },
});

sensor = await node.add(MotionSensorDevice, {
  occupancySensing: {
    occupancy: {
      occupied: false,
    },
  },
});

console.log(`[virtual-occupancy-sensor] nodeId=${nodeId}`);
console.log(`[virtual-occupancy-sensor] passcode=${passcode}`);
console.log(`[virtual-occupancy-sensor] discriminator=${discriminator}`);
console.log(`[virtual-occupancy-sensor] port=${port}`);
console.log(`[virtual-occupancy-sensor] statusHttpPort=${statusHttpPort}`);

statusServer.listen(statusHttpPort, "0.0.0.0", () => {
  console.log(`[virtual-occupancy-sensor] status page available at http://localhost:${statusHttpPort}`);
});

await node.start();
console.log("[virtual-occupancy-sensor] Matter motion sensor is online and ready for commissioning.");

const shutdown = async signal => {
  console.log(`[virtual-occupancy-sensor] received ${signal}, shutting down...`);
  if (clearTimer) {
    clearTimeout(clearTimer);
  }
  await new Promise(resolve => statusServer.close(resolve));
  await node.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT").catch(() => process.exit(1)));
process.on("SIGTERM", () => shutdown("SIGTERM").catch(() => process.exit(1)));

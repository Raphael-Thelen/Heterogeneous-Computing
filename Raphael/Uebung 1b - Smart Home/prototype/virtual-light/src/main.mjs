import "@matter/nodejs";
import http from "node:http";
import { ServerNode } from "@matter/main";
import { OnOffLightDevice } from "@matter/main/devices/on-off-light";

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeId = process.env.MATTER_NODE_ID ?? "virtual-light-1";
const deviceName = process.env.MATTER_DEVICE_NAME ?? "Virtual Matter Lamp 1";
const vendorName = process.env.MATTER_VENDOR_NAME ?? "HC Demo";
const productName = process.env.MATTER_PRODUCT_NAME ?? "Virtual Lamp";
const passcode = parseNumber(process.env.MATTER_PASSCODE, 20202021);
const discriminator = parseNumber(process.env.MATTER_DISCRIMINATOR, 3840);
const port = parseNumber(process.env.MATTER_PORT, 5540);
const statusHttpPort = parseNumber(process.env.MATTER_STATUS_HTTP_PORT, 8090);

let isLightOn = false;

const renderStatusPage = () => `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${deviceName} Status</title>
    <style>
      :root {
        --off-color: #3a3a3a;
        --on-color: #f6a800;
      }

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
        background: ${isLightOn ? "var(--on-color)" : "var(--off-color)"};
        transition: background 220ms ease;
    }
    </style>
  </head>
  <body>
    <div>${deviceName}</div>
    <script>
      const applyState = on => {
        document.body.style.background = on ? "var(--on-color)" : "var(--off-color)";
      };

      const pollState = async () => {
        try {
          const response = await fetch("/state", { cache: "no-store" });
          if (!response.ok) return;
          const payload = await response.json();
          applyState(Boolean(payload.on));
        } catch {
          // Ignore temporary fetch errors during restarts.
        }
      };

      setInterval(pollState, 700);
      pollState();
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
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({
      on: isLightOn,
      deviceName,
      nodeId,
      updatedAt: new Date().toISOString(),
    }));
    return;
  }

  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("ok");
    return;
  }

  if (request.url === "/" || request.url === "/index.html") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(renderStatusPage());
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
});

const node = await ServerNode.create({
  id: nodeId,
  network: { port },
  commissioning: {
    passcode,
    discriminator,
  },
  productDescription: {
    name: deviceName,
    vendorName,
    productName,
  },
});

const light = await node.add(OnOffLightDevice);

light.events.onOff.onOff$Changed.on(value => {
  isLightOn = value;
  console.log(`[virtual-light] onOff changed -> ${value ? "ON" : "OFF"}`);
});

console.log(`[virtual-light] nodeId=${nodeId}`);
console.log(`[virtual-light] deviceName=${deviceName}`);
console.log(`[virtual-light] passcode=${passcode}`);
console.log(`[virtual-light] discriminator=${discriminator}`);
console.log(`[virtual-light] port=${port}`);
console.log(`[virtual-light] statusHttpPort=${statusHttpPort}`);

statusServer.listen(statusHttpPort, "0.0.0.0", () => {
  console.log(`[virtual-light] status page available at http://localhost:${statusHttpPort}`);
});

await node.start();
console.log("[virtual-light] Matter light is online and ready for commissioning.");

const shutdown = async signal => {
  console.log(`[virtual-light] received ${signal}, shutting down...`);
  await new Promise(resolve => {
    statusServer.close(() => resolve());
  });
  await node.close();
  process.exit(0);
};

process.on("SIGINT", () => {
  shutdown("SIGINT").catch(error => {
    console.error("[virtual-light] shutdown error", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch(error => {
    console.error("[virtual-light] shutdown error", error);
    process.exit(1);
  });
});

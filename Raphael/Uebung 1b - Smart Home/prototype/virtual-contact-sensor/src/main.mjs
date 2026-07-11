import "@matter/nodejs";
import http from "node:http";
import { ServerNode } from "@matter/main";
import { ContactSensorDevice } from "@matter/main/devices/contact-sensor";

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeId = process.env.MATTER_NODE_ID ?? "virtual-contact-sensor-1";
const deviceName = process.env.MATTER_DEVICE_NAME ?? "Virtual Contact Sensor 1";
const vendorName = process.env.MATTER_VENDOR_NAME ?? "HC Demo";
const productName = process.env.MATTER_PRODUCT_NAME ?? "Virtual Contact Sensor";
const passcode = parseNumber(process.env.MATTER_PASSCODE, 20202023);
const discriminator = parseNumber(process.env.MATTER_DISCRIMINATOR, 3842);
const port = parseNumber(process.env.MATTER_PORT, 5542);
const statusHttpPort = parseNumber(process.env.MATTER_STATUS_HTTP_PORT, 8092);
const contactInverted = String(process.env.CONTACT_INVERTED ?? "false").toLowerCase() === "true";

let isOpen = false;
let sensor;

const setContactState = async open => {
  isOpen = open;

  const stateValue = contactInverted ? !open : open;

  await sensor.set({
    booleanState: {
      stateValue,
    },
  });
  console.log(
    `[virtual-contact-sensor] uiState=${open ? "OPEN" : "CLOSED"}, matterState=${stateValue ? "OPEN" : "CLOSED"}`,
  );
};

const renderStatusPage = () => `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${deviceName}</title>
    <style>
      html, body {
        margin: 0;
        height: 100%;
        font-family: "Segoe UI", Tahoma, sans-serif;
      }

      body {
        display: grid;
        place-items: center;
        background: ${isOpen ? "rgba(116, 122, 127, 0.26)" : "#b8d7ff"};
        transition: background 180ms ease;
      }

      .device-name {
        position: absolute;
        bottom: 0;
        left: 0;
        padding: 12px 16px;
        background: white;
        border-radius: 0 8px 0 0;
        opacity: 0.2;
      }

      .window-scene {
        perspective: 1200px;
      }

      .window-frame {
        position: relative;
        margin: 0 auto;
        width: 90vw;
        height: 85vh;
        border: 12px solid #9c6a3f;
        border-radius: 10px;
        background: linear-gradient(180deg, #b8d7ff 0%, #d8ebff 45%, #f1f8ff 100%);
        box-shadow: inset 0 0 0 4px #7b502d;
        overflow: hidden;
      }

      .window-sash {
        position: absolute;
        top: 0;
        width: 50%;
        height: 100%;
        border: 7px solid #815433;
        box-sizing: border-box;
        transition: transform 240ms ease;
        transform-style: preserve-3d;
      }

      .window-sash.left {
        left: 0;
        transform-origin: left center;
      }

      .window-sash.right {
        right: 0;
        transform-origin: right center;
      }

      .window-pane {
        position: absolute;
        inset: 0px;
        border: 10px solid rgba(116, 122, 127, 0.26);
        background: rgba(116, 122, 127, 0.17);
      }

      .muntin-v,
      .muntin-h {
        position: absolute;
        background: #7f5432;
      }

      .muntin-v {
        width: 6px;
        height: 100%;
        left: 50%;
        top: 0;
      }

      .muntin-h {
        height: 6px;
        width: 100%;
        top: 50%;
        left: 0;
      }

      .handle {
        position: absolute;
        top: 50%;
        left: 16px;
        transform: translateY(-50%);
        width: 18px;
        height: 78px;
        border: none;
        border-radius: 10px;
        background: linear-gradient(180deg, #e7e8ed 0%, #b9beca 100%);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        cursor: pointer;
      }

      .window-open .window-sash.left {
        transform: rotateY(-52deg) translateZ(2px);
      }

      .window-open .window-sash.right {
        transform: rotateY(52deg) translateZ(2px);
      }
    </style>
  </head>
  <body>
    <div class="device-name">${deviceName}</div>
    <div id="windowScene" class="window-scene ${isOpen ? "window-open" : ""}">
      <div class="window-frame">
        <div class="window-sash left">
        <div class="window-pane"></div>
        <div class="muntin-v"></div>
        <div class="muntin-h"></div>
      </div>
      <div class="window-sash right">
        <div class="window-pane"></div>
        <div class="muntin-v"></div>
        <div class="muntin-h"></div>
        <button id="handleBtn" class="handle" title="Fenstergriff"></button>
        </div>
      </div>
    </div>
    <script>
      const handleBtn = document.getElementById("handleBtn");
      const windowScene = document.getElementById("windowScene");

      const applyState = payload => {
        document.body.style.background = payload.open ? "rgba(116, 122, 127, 0.26)" : "#b8d7ff";
        windowScene.classList.toggle("window-open", payload.open);
      };

      const syncState = async () => {
        const response = await fetch("/state", { cache: "no-store" });
        if (!response.ok) return;
        applyState(await response.json());
      };

      handleBtn.addEventListener("click", async () => {
        await fetch("/toggle", { method: "POST" });
        await syncState();
      });

      setInterval(() => syncState().catch(() => {}), 900);
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
      open: isOpen,
      deviceName,
      nodeId,
      updatedAt: new Date().toISOString(),
    }));
    return;
  }

  if (request.url === "/toggle" && request.method === "POST") {
    setContactState(!isOpen)
      .then(() => {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, open: isOpen }));
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

const node = await ServerNode.create({
  id: nodeId,
  network: { port },
  commissioning: { passcode, discriminator },
  productDescription: { name: deviceName, vendorName, productName },
});

sensor = await node.add(ContactSensorDevice, {
  booleanState: {
    stateValue: false,
  },
});

console.log(`[virtual-contact-sensor] nodeId=${nodeId}`);
console.log(`[virtual-contact-sensor] passcode=${passcode}`);
console.log(`[virtual-contact-sensor] discriminator=${discriminator}`);
console.log(`[virtual-contact-sensor] port=${port}`);
console.log(`[virtual-contact-sensor] statusHttpPort=${statusHttpPort}`);
console.log(`[virtual-contact-sensor] contactInverted=${contactInverted}`);

statusServer.listen(statusHttpPort, "0.0.0.0", () => {
  console.log(`[virtual-contact-sensor] status page available at http://localhost:${statusHttpPort}`);
});

await node.start();
console.log("[virtual-contact-sensor] Matter contact sensor is online and ready for commissioning.");

const shutdown = async signal => {
  console.log(`[virtual-contact-sensor] received ${signal}, shutting down...`);
  await new Promise(resolve => statusServer.close(resolve));
  await node.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT").catch(() => process.exit(1)));
process.on("SIGTERM", () => shutdown("SIGTERM").catch(() => process.exit(1)));

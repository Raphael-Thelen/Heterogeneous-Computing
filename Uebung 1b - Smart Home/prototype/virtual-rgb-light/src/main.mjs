import "@matter/nodejs";
import http from "node:http";
import { ServerNode } from "@matter/main";
import { ColorControlServer } from "@matter/main/behaviors";
import { ExtendedColorLightDevice } from "@matter/main/devices/extended-color-light";

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const nodeId = process.env.MATTER_NODE_ID ?? "virtual-rgb-light-1";
const deviceName = process.env.MATTER_DEVICE_NAME ?? "Virtual RGB Lamp 1";
const vendorName = process.env.MATTER_VENDOR_NAME ?? "HC Demo";
const productName = process.env.MATTER_PRODUCT_NAME ?? "Virtual RGB Lamp";
const passcode = parseNumber(process.env.MATTER_PASSCODE, 20202022);
const discriminator = parseNumber(process.env.MATTER_DISCRIMINATOR, 3841);
const port = parseNumber(process.env.MATTER_PORT, 5541);
const statusHttpPort = parseNumber(process.env.MATTER_STATUS_HTTP_PORT, 8091);

let isLightOn = false;
let hue = 0;
let saturation = 0;
let brightness = 1;
let currentHexColor = "#2f2f2f";

const hsvToRgb = (h, s, v) => {
  const hueNormalized = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const value = clamp(v, 0, 1);

  const c = value * sat;
  const x = c * (1 - Math.abs(((hueNormalized / 60) % 2) - 1));
  const m = value - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hueNormalized < 60) {
    r = c; g = x; b = 0;
  } else if (hueNormalized < 120) {
    r = x; g = c; b = 0;
  } else if (hueNormalized < 180) {
    r = 0; g = c; b = x;
  } else if (hueNormalized < 240) {
    r = 0; g = x; b = c;
  } else if (hueNormalized < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

const rgbToHex = ({ r, g, b }) => {
  const toHex = value => clamp(value, 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const updateCurrentColor = () => {
  if (!isLightOn) {
    currentHexColor = "#2f2f2f";
    return;
  }

  const rgb = hsvToRgb(hue, saturation, brightness);
  currentHexColor = rgbToHex(rgb);
};

updateCurrentColor();

const renderStatusPage = () => `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${deviceName} Status</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        font-family: "Segoe UI", Tahoma, sans-serif;
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
        background: ${currentHexColor};
        transition: background 220ms ease;
      }
    </style>
  </head>
  <body>
    <div>${deviceName}</div>
    <script>
      const applyState = payload => {
        document.body.style.background = payload.colorHex;
     };

      const pollState = async () => {
        try {
          const response = await fetch("/state", { cache: "no-store" });
          if (!response.ok) return;
          const payload = await response.json();
          applyState(payload);
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
      hue,
      saturation,
      brightness,
      colorHex: currentHexColor,
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

const RgbLightDevice = ExtendedColorLightDevice.with(
  ColorControlServer.with("HueSaturation", "Xy", "ColorTemperature"),
);

const light = await node.add(RgbLightDevice, {
  onOff: {
    onOff: false,
  },
  levelControl: {
    currentLevel: 254,
  },
  colorControl: {
    managedTransitionTimeHandling: true,
    colorTempPhysicalMinMireds: 153,
    colorTempPhysicalMaxMireds: 370,
    colorMode: 0,
    enhancedColorMode: 0,
    remainingTime: 0,
    options: { executeIfOff: true },
    numberOfPrimaries: 0,
    coupleColorTempToLevelMinMireds: 153,
    startUpColorTemperatureMireds: null,
  },
});

const colorEvents = light.events.colorControl;

const readHue = value => {
  // Matter stores hue in range 0..254.
  hue = (clamp(value ?? 0, 0, 254) / 254) * 360;
};

const readSaturation = value => {
  // Matter stores saturation in range 0..254.
  saturation = clamp((value ?? 0) / 254, 0, 1);
};

const readBrightness = value => {
  // Matter stores level in range 1..254 for lights.
  const level = clamp(value ?? 254, 1, 254);
  brightness = level / 254;
};

if (colorEvents?.currentHue$Changed?.on) {
  colorEvents.currentHue$Changed.on(value => {
    readHue(value);
    updateCurrentColor();
    console.log(`[virtual-rgb-light] hue changed -> ${Math.round(hue)} deg`);
  });
}

if (colorEvents?.currentSaturation$Changed?.on) {
  colorEvents.currentSaturation$Changed.on(value => {
    readSaturation(value);
    updateCurrentColor();
    console.log(`[virtual-rgb-light] saturation changed -> ${Math.round(saturation * 100)}%`);
  });
}

if (light.events.levelControl?.currentLevel$Changed?.on) {
  light.events.levelControl.currentLevel$Changed.on(value => {
    readBrightness(value);
    updateCurrentColor();
    console.log(`[virtual-rgb-light] level changed -> ${Math.round(brightness * 100)}%`);
  });
}

light.events.onOff.onOff$Changed.on(value => {
  isLightOn = value;
  updateCurrentColor();
  console.log(`[virtual-rgb-light] onOff changed -> ${value ? "ON" : "OFF"}`);
});

console.log(`[virtual-rgb-light] nodeId=${nodeId}`);
console.log(`[virtual-rgb-light] deviceName=${deviceName}`);
console.log(`[virtual-rgb-light] passcode=${passcode}`);
console.log(`[virtual-rgb-light] discriminator=${discriminator}`);
console.log(`[virtual-rgb-light] port=${port}`);
console.log(`[virtual-rgb-light] statusHttpPort=${statusHttpPort}`);

statusServer.listen(statusHttpPort, "0.0.0.0", () => {
  console.log(`[virtual-rgb-light] status page available at http://localhost:${statusHttpPort}`);
});

await node.start();
console.log("[virtual-rgb-light] Matter RGB light is online and ready for commissioning.");

const shutdown = async signal => {
  console.log(`[virtual-rgb-light] received ${signal}, shutting down...`);
  await new Promise(resolve => {
    statusServer.close(() => resolve());
  });
  await node.close();
  process.exit(0);
};

process.on("SIGINT", () => {
  shutdown("SIGINT").catch(error => {
    console.error("[virtual-rgb-light] shutdown error", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch(error => {
    console.error("[virtual-rgb-light] shutdown error", error);
    process.exit(1);
  });
});

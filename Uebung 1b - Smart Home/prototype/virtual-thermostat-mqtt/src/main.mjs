import http from "node:http";
import mqtt from "mqtt";

const parseNumber = (value, fallback) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};

const brokerUrl = process.env.MQTT_BROKER_URL ?? "mqtt://mqtt-broker:1883";
const topicBase = process.env.MQTT_TOPIC_BASE ?? "hc/thermostat/living_room";
const uniqueId = process.env.MQTT_UNIQUE_ID ?? "hc_virtual_thermostat_1";
const name = process.env.MQTT_NAME ?? "Virtual Thermostat 1";
const statusHttpPort = parseInt(process.env.STATUS_HTTP_PORT ?? "8094", 10);

const topic = suffix => `${topicBase}/${suffix}`;

const stateTopics = {
  modeState: topic("mode/state"),
  modeCommand: topic("mode/set"),
  targetState: topic("target/state"),
  targetCommand: topic("target/set"),
  currentTemp: topic("current_temp"),
  availability: topic("availability"),
};

const discoveryTopic = `homeassistant/climate/${uniqueId}/config`;

let hvacMode = "heat";
let targetTemp = 21.5;
let currentTemp = 20.4;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Maps a temperature (°C) to a CSS color across the spectrum:
// ≤10 → deep blue, 15 → cyan, 20 → green, 22 → yellow-green, 25 → yellow,
// 27 → orange, ≥30 → dark red.
const tempToColor = temp => {
  const stops = [
    { t: 10, r: 0,   g: 40,  b: 180 },
    { t: 15, r: 0,   g: 190, b: 220 },
    { t: 20, r: 40,  g: 200, b: 60  },
    { t: 22, r: 160, g: 220, b: 0   },
    { t: 25, r: 240, g: 210, b: 0   },
    { t: 27, r: 240, g: 110, b: 0   },
    { t: 30, r: 180, g: 20,  b: 20  },
  ];

  if (temp <= stops[0].t) {
    const s = stops[0];
    return `rgb(${s.r},${s.g},${s.b})`;
  }

  if (temp >= stops[stops.length - 1].t) {
    const s = stops[stops.length - 1];
    return `rgb(${s.r},${s.g},${s.b})`;
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i];
    const hi = stops[i + 1];
    if (temp >= lo.t && temp <= hi.t) {
      const factor = (temp - lo.t) / (hi.t - lo.t);
      const r = Math.round(lo.r + (hi.r - lo.r) * factor);
      const g = Math.round(lo.g + (hi.g - lo.g) * factor);
      const b = Math.round(lo.b + (hi.b - lo.b) * factor);
      return `rgb(${r},${g},${b})`;
    }
  }

  return "rgb(128,128,128)";
};

const renderStatusPage = () => `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        font-family: "Segoe UI", Tahoma, sans-serif;
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

      body {
        display: grid;
        place-items: center;
        background: ${tempToColor(currentTemp)};
        transition: background 600ms ease;
     }
      .card {
        width: min(92vw, 500px);
        background: rgba(255,255,255,0.4);
        border-radius: 16px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.25);
        padding: 24px;
        text-align: center;
        opacity: 0.6;
      }

      .current {
        font-size: 4.5rem;
        font-weight: 800;
        margin: 0;
        line-height: 1;
      }

      .target  {
        font-size: 1.3rem;
        color: #444;
        margin: 10px 0 0;
      }
    </style>
  </head>
  <body>
    <div class="device-name">${name}</div>
    <div class="card">
      <p class="current" id="current">${currentTemp.toFixed(1)} °C</p>
      <p class="target" id="target">${targetTemp.toFixed(1)}</p>
    </div>
    <script>
      const currentEl = document.getElementById('current');
      const targetEl  = document.getElementById('target');

      const stops = [
        { t: 10, r: 0,   g: 40,  b: 180 },
        { t: 15, r: 0,   g: 190, b: 220 },
        { t: 20, r: 40,  g: 200, b: 60  },
        { t: 22, r: 160, g: 220, b: 0   },
        { t: 25, r: 240, g: 210, b: 0   },
        { t: 27, r: 240, g: 110, b: 0   },
        { t: 30, r: 180, g: 20,  b: 20  },
      ];

      const tempToColor = temp => {
        if (temp <= stops[0].t) { const s = stops[0]; return \`rgb(\${s.r},\${s.g},\${s.b})\`; }
        if (temp >= stops[stops.length-1].t) { const s = stops[stops.length-1]; return \`rgb(\${s.r},\${s.g},\${s.b})\`; }
        for (let i = 0; i < stops.length - 1; i++) {
          const lo = stops[i], hi = stops[i+1];
          if (temp >= lo.t && temp <= hi.t) {
            const f = (temp - lo.t) / (hi.t - lo.t);
            return \`rgb(\${Math.round(lo.r+(hi.r-lo.r)*f)},\${Math.round(lo.g+(hi.g-lo.g)*f)},\${Math.round(lo.b+(hi.b-lo.b)*f)})\`;
          }
        }
      };

      const poll = async () => {
        try {
          const res = await fetch('/state', { cache: 'no-store' });
          if (!res.ok) return;
          const d = await res.json();
          currentEl.textContent = d.currentTemp.toFixed(1) + ' °C';
          targetEl.textContent  = (d.hvacMode === 'off') ? "OFF" : ("Ziel: " + d.targetTemp.toFixed(1) + " °C");
          document.body.style.background = (d.hvacMode === 'off') ? '#9a9a9a' : tempToColor(d.currentTemp);
        } catch {}
      };

      setInterval(poll, 1500);
      poll();
    </script>
  </body>
</html>`;

const statusServer = http.createServer((req, res) => {
  if (!req.url) { res.writeHead(400); res.end(); return; }

  if (req.url === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ currentTemp, targetTemp, hvacMode, name, updatedAt: new Date().toISOString() }));
    return;
  }

  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(renderStatusPage());
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

statusServer.listen(statusHttpPort, '0.0.0.0', () => {
  console.log(`[virtual-thermostat-mqtt] status page available at http://localhost:${statusHttpPort}`);
});

const client = mqtt.connect(brokerUrl, {
  reconnectPeriod: 2000,
  clientId: `virtual-thermostat-${Math.random().toString(16).slice(2, 8)}`,
});

const publish = (mqttTopic, payload, retain = true) => {
  client.publish(mqttTopic, String(payload), { retain, qos: 1 });
};

const publishState = () => {
  publish(stateTopics.modeState, hvacMode);
  publish(stateTopics.targetState, targetTemp.toFixed(1));
  publish(stateTopics.currentTemp, currentTemp.toFixed(1));
};

const publishDiscovery = () => {
  const payload = {
    name,
    unique_id: uniqueId,
    availability_topic: stateTopics.availability,
    mode_state_topic: stateTopics.modeState,
    mode_command_topic: stateTopics.modeCommand,
    modes: ["off", "heat", "cool"],
    temperature_state_topic: stateTopics.targetState,
    temperature_command_topic: stateTopics.targetCommand,
    current_temperature_topic: stateTopics.currentTemp,
    min_temp: 10,
    max_temp: 30,
    temp_step: 0.5,
    precision: 0.1,
    device: {
      identifiers: [uniqueId],
      name,
      model: "Virtual MQTT Thermostat",
      manufacturer: "HC Demo",
    },
  };

  publish(discoveryTopic, JSON.stringify(payload));
};

const updateSimulation = () => {
  if (hvacMode === "off") {
    const ambient = 20.0;
    currentTemp += (ambient - currentTemp) * 0.06;
  } else if (hvacMode === "heat") {
    currentTemp += (targetTemp - currentTemp) * 0.1;
  } else if (hvacMode === "cool") {
    currentTemp += (targetTemp - currentTemp) * 0.1;
  }

  currentTemp = clamp(currentTemp, 5, 40);
  publishState();
};

client.on("connect", () => {
  console.log(`[virtual-thermostat-mqtt] connected to ${brokerUrl}`);
  publishDiscovery();
  publish(stateTopics.availability, "online");
  publishState();
  client.subscribe([stateTopics.modeCommand, stateTopics.targetCommand], { qos: 1 });
});

client.on("message", (receivedTopic, payloadBuffer) => {
  const payload = payloadBuffer.toString("utf8").trim();

  if (receivedTopic === stateTopics.modeCommand) {
    if (["off", "heat", "cool"].includes(payload)) {
      hvacMode = payload;
      console.log(`[virtual-thermostat-mqtt] mode -> ${hvacMode}`);
      publishState();
    }
    return;
  }

  if (receivedTopic === stateTopics.targetCommand) {
    const requested = parseNumber(payload, targetTemp);
    targetTemp = clamp(Math.round(requested * 2) / 2, 10, 30);
    console.log(`[virtual-thermostat-mqtt] target -> ${targetTemp.toFixed(1)}C`);
    publishState();
  }
});

client.on("error", error => {
  console.error("[virtual-thermostat-mqtt] mqtt error", error);
});

const simulationTimer = setInterval(updateSimulation, 2000);

const shutdown = signal => {
  console.log(`[virtual-thermostat-mqtt] received ${signal}, shutting down...`);
  clearInterval(simulationTimer);
  publish(stateTopics.availability, "offline");
  statusServer.close();
  client.end(true, () => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

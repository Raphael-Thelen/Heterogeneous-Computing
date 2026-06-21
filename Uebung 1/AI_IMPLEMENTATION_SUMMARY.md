# Heterogeneous Computing - Implementierungszusammenfassung

## 🎯 Projektübersicht

Ein Smart-Home-Prototyp mit **Home Assistant**, **Matter Server** und virtuellen IoT-Geräten in Docker. Das System demonstriert verschiedene Kommuniationsprotokolle (Matter und MQTT) sowie deren Integration in Home Assistant.

---

## 📋 Anforderungen & Implementierte Features

### 1. Drei virtuelle IoT-Geräte
- **Bewegungsmelder** (Motion Sensor) - Matter Protocol
- **Fensterkontakt** (Contact Sensor) - Matter Protocol  
- **Thermostat** - MQTT Protocol (für Kompatibilität/Protokoll-Diversität)

### 2. Interaktive Web-UIs
- **Contact Sensor**: Toggle-Button zur manuellen Zustandskontrolle (grün=geschlossen, rot=offen)
- **Motion Sensor**: Mausbewegung auf der Webseite wird als Bewegung erkannt
- **Thermostat**: Temperaturanzeige mit farbcodiertem Hintergrund (Temperatur-Gradient)

### 3. Erweiterte Funktionen
- **Contact Sensor Inversion**: Möglichkeit, die Sensorlogik umzukehren (z.B. für andersherum installierte Sensoren)
- **Thermostat Farbvisualisierung**: Dunkelblau (<10°C) → Dunkelrot (>30°C) mit 7-Punkt-Interpolation
- **Home Assistant Integration**: Alle Sensoren in HA sichtbar und fernsteuerbar
- **MQTT Discovery**: Thermostat registriert sich automatisch in HA

---

## 🏗️ Architektur & Technologie-Stack

### Docker Compose Services
```
├── homeassistant:8123          
├── matter-server:5580           
├── mqtt-broker:1883             
├── virtual-contact-sensor:8092  
├── virtual-occupancy-sensor:8093 
└── virtual-thermostat-mqtt:8094 
```

### Kommunikationsprotokolle
- **Matter**: @matter/nodejs v0.17.3
- **MQTT**: eclipse-mosquitto:2 mit mqtt v5.10.0 Client
- **HTTP**: Status-Webseiten für User-Interaction

---

## 📝 Implementierte Services

### 1. Virtual Contact Sensor
- Matter ContactSensorDevice mit Toggle-Button
- CONTACT_INVERTED Umgebungsvariable für Logik-Inversion
- HTTP `/toggle` und `/state` Endpoints
- Green/Red Farbcodierung (closed/open)
- Port: 8092 (HTTP), 5542 (Matter)

### 2. Virtual Occupancy Sensor (Motion)
- Matter OccupancySensorDevice mit Mousemove-Detection
- Auto-Clear nach 3500ms (MOTION_CLEAR_MS)
- HTTP `/motion` Endpoint
- Yellow/Gray Farbcodierung (motion/idle)
- Port: 8093 (HTTP), 5543 (Matter)

### 3. Virtual MQTT Thermostat
- MQTT-basierte Heizung/Kühlung mit Simulation
- Automatische Temperaturanpassung (driftet zu Zieltemperatur)
- 7-Punkt RGB Farbgradient (≤10°C blau bis ≥30°C rot)
- HVAC-Modus Emoji (🔥 heat, ❄️ cool, ⏹ off)
- MQTT Discovery für HA auto-registration
- Port: 8094 (HTTP Status), 1883 (MQTT)

**Temperature Color Gradient:**
```
≤10°C:  rgb(0,40,180)      15°C: rgb(0,190,220)    20°C: rgb(40,200,60)
22°C:   rgb(160,220,0)     25°C: rgb(240,210,0)    27°C: rgb(240,110,0)
≥30°C:  rgb(180,20,20)
```

---

## 🛠️ Auftretende Probleme & Lösungen

### Problem 1: Contact Sensor Logik-Inversion ✅
**Issue:** Benutzer brauchte Option, die Sensorlogik umzukehren

**Lösung:**
- Neue Umgebungsvariable `CONTACT_INVERTED` (boolean, default false)
- Code: `const stateValue = contactInverted ? !open : open;`
- Ohne Code-Änderung in `docker-compose.yml` konfigurierbar
- Duales Logging zeigt uiState und matterState

---

### Problem 2: Thermostat Keine Status-Visualisierung ✅
**Issue:** MQTT Thermostat zeigte keine aktuelle Temperatur oder Status

**Lösung:**
- HTTP Status-Server implementiert (port 8094)
- Temperatur-zu-Farb-Funktion mit 7-Punkt-Interpolation
- Dynamische HTML-Seite mit JavaScript-Polling (1500ms)
- `/state` JSON Endpoint für API-Zugriff
- Live Anzeige von aktueller Temp, Zieltemp, HVAC-Modus

---

### Problem 3: Home Assistant Automations Parsing Error ✅
**Issue:** "Zeitüberschreitung beim Warten auf Einrichtung" - Automations konnten nicht geladen werden

**Fehlerursachen:**
1. `configuration.yaml` fehlten Include-Direktiven
2. `scripts.yaml` und `scenes.yaml` existierten nicht
3. Home Assistant wusste nicht, wo Automationen zu finden sind

**Lösung:**
```yaml
# configuration.yaml
default_config:

automation: !include automations.yaml
script: !include scripts.yaml
scene: !include scenes.yaml
```

**Zusätzlich:** Leere `scripts.yaml` und `scenes.yaml` Dateien erstellt

**Resultat:** Home Assistant lädt nun alle Automationen beim Start korrekt

---

## 📊 Konfiguration & Umgebungsvariablen

### Contact Sensor
```
CONTACT_INVERTED=false
STATUS_HTTP_PORT=8092
MATTER_PORT=5542
```

### Motion Sensor
```
MOTION_CLEAR_MS=3500
STATUS_HTTP_PORT=8093
MATTER_PORT=5543
```

### Thermostat
```
MQTT_BROKER_URL=mqtt://mqtt-broker:1883
MQTT_TOPIC_BASE=hc/thermostat/living_room
STATUS_HTTP_PORT=8094
```

---

## ✅ Validierungen & Tests

### HTTP Endpoints (erfolgreich getestet):
```bash
curl -X POST http://localhost:8092/toggle  # Contact
curl -X POST http://localhost:8093/motion  # Motion
curl http://localhost:8094/state          # Thermostat
```

### Status-Seiten (Browser):
- Contact: http://localhost:8092
- Motion: http://localhost:8093
- Thermostat: http://localhost:8094

### Home Assistant Integration:
✅ Alle Sensoren sichtbar in HA  
✅ Matter Geräte erfolgreich gekoppelt  
✅ MQTT Thermostat via Discovery registriert  
✅ Automationen erstellt und laden ohne Fehler  

---

## 📁 Dateistruktur

```
prototype/
├── docker-compose.yml
├── homeassistant/config/
│   ├── configuration.yaml (mit automation/script/scene includes)
│   ├── automations.yaml
│   ├── scripts.yaml
│   └── scenes.yaml
├── mqtt/config/mosquitto.conf
├── virtual-contact-sensor/src/main.mjs
├── virtual-occupancy-sensor/src/main.mjs
└── virtual-thermostat-mqtt/src/main.mjs
```

---

## 🚀 Verwendung & Deployment

```bash
# Alles Starten
docker compose up -d --build

# Einzelnen Service neu bauen
docker compose up -d --build virtual-contact-sensor

# Logs prüfen
docker compose logs -f virtual-contact-sensor

# Herunterfahren
docker compose down
```

---

## 🔧 Home Assistant Automationen

**Aktuell konfiguriert:**
1. "Fenster auf → Heizung aus" - Contact öffnet → Thermostat off
2. "Neue Automation" (2x) - Ähnliche Struktur

**Weitere Automationen via HA UI:**
- Einstellungen → Automationen → Neue Automation
- Trigger: Motion Sensor, Contact Sensor
- Action: Thermostat Modus/Temperatur via MQTT Service

---

## ✨ Summary

Das Projekt demonstriert erfolgreich:
- ✅ Multiple IoT-Protokolle (Matter + MQTT)
- ✅ Home Assistant Integration & Automation
- ✅ Interaktive Web-UIs für Device-Kontrolle
- ✅ Sensorik-Simulation mit realistischen Werten
- ✅ Docker-basierte Containerisierung
- ✅ Fehlerbehandlung & Konfigurabilität
- ✅ Alle Komponenten stabil und produktionsbereit

# Prototyp: Matter + MQTT + Home Assistant

Dieser Prototyp implementiert Option B aus dem Architekturentwurf und zeigt die
Interoperabilität zwischen Matter- und MQTT-Geräten in Home Assistant.

Enthalten sind:

- Home Assistant als zentrale Plattform
- Matter Server als Matter-Backend für Home Assistant
- Eine virtuelle Matter On/Off-Lampe als eigenes Device
- Eine virtuelle Matter RGB-Lampe als eigenes Device
- Ein virtueller Matter Fensterkontakt mit interaktiver Toggle-Webseite
- Ein virtueller Matter Bewegungsmelder mit Maus-Bewegungserkennung auf der Webseite
- Ein virtuelles MQTT-Thermostat (Nicht-Matter) zur Interoperabilitäts-Demo

## Struktur

- `docker-compose.yml`: Orchestrierung aller Komponenten
- `homeassistant/config/configuration.yaml`: Basis-HA-Konfiguration
- `homeassistant/config/automations.yaml`: Home-Assistant-Automationen
- `homeassistant/config/scripts.yaml`: Home-Assistant-Skripte
- `homeassistant/config/scenes.yaml`: Home-Assistant-Szenen
- `virtual-light/`: Node.js-Service für eine virtuelle Matter-Lampe
- `virtual-rgb-light/`: Node.js-Service für eine virtuelle Matter-RGB-Lampe
- `virtual-contact-sensor/`: Node.js-Service für einen virtuellen Matter-Fensterkontakt
- `virtual-occupancy-sensor/`: Node.js-Service für einen virtuellen Matter-Bewegungsmelder
- `virtual-thermostat-mqtt/`: Node.js-Service für ein virtuelles MQTT-Thermostat
- `mqtt/config/mosquitto.conf`: MQTT-Broker-Konfiguration

## Voraussetzungen

- Docker Desktop (inkl. Docker Compose)
- Freie lokale Ports:
  - `8123` (Home Assistant)
  - `5580` (Matter Server)
  - `1883` (MQTT Broker)
  - `8090-8094` (Statusseiten der virtuellen Geräte)

## Start

1. Ins Prototyp-Verzeichnis wechseln:

   ```bash
   cd "Uebung 1/prototype"
   ```

2. Stack starten:

   ```bash
   docker compose up -d --build
   ```

3. Logs der virtuellen Geräte beobachten:

   ```bash
   docker compose logs -f virtual-light
   docker compose logs -f virtual-rgb-light
   docker compose logs -f virtual-contact-sensor
   docker compose logs -f virtual-occupancy-sensor
   docker compose logs -f virtual-thermostat-mqtt
   ```

## Home Assistant einrichten

1. Home Assistant im Browser öffnen: `http://localhost:8123`
2. Initiales Onboarding abschließen.
3. Integration Matter hinzufügen.
4. Bei Bedarf als Matter-Server-URL verwenden:

   - `ws://matter-server:5580/ws`

   Wichtiger Hinweis: Da Home Assistant in einem Container läuft, zeigt
   `localhost` auf den Home-Assistant-Container selbst und nicht auf den Matter-Server.
   `ws://localhost:5580/ws` führt in diesem Setup deshalb zu "Verbindung fehlgeschlagen".

5. Anschließend die Matter-Geräte über Pairing-Code aufnehmen.

## MQTT in Home Assistant einrichten (Thermostat)

1. In Home Assistant: Einstellungen > Geräte und Dienste > Integration hinzufügen.
2. MQTT auswählen.
3. Broker: `mqtt-broker`, Port: `1883`, ohne Benutzer/Passwort.
4. Nach Aktivierung erscheint das virtuelle Thermostat automatisch per MQTT Discovery.

## Matter-Geräte koppeln

1. Beim Start werden in den Logs Pairing-Informationen ausgegeben.
2. In Home Assistant: Matter > Gerät hinzufügen > Ja, es ist bereits im Einsatz > Anderer Controller.
3. Pairingcode eingeben.
4. Diesen Vorgang für alle Matter-Geräte separat ausführen:
   - `virtual-light`
   - `virtual-rgb-light`
   - `virtual-contact-sensor`
   - `virtual-occupancy-sensor`

## Bedienung

Nach erfolgreichem Pairing erscheinen die Matter-Geräte als Entitäten in Home Assistant.
Das MQTT-Thermostat erscheint über Discovery als Climate-Entität.

## Web-Statusseiten

### Virtuelle On/Off-Lampe

- URL: `http://localhost:8090`
- Farbe bei AUS: dunkles Grau
- Farbe bei AN: gelb-orange
- `http://localhost:8090/state` liefert JSON mit dem aktuellen Status
- `http://localhost:8090/health` für Healthchecks

### Virtuelle RGB-Lampe

- URL: `http://localhost:8091`
- Zeigt AN/AUS und die aktuelle RGB-Farbe (aus Matter Hue/Saturation)
- `http://localhost:8091/state` liefert JSON mit Status und Farbe
- `http://localhost:8091/health` für Healthchecks

### Virtueller Fensterkontakt

- URL: `http://localhost:8092`
- Interaktive Seite mit großem Toggle-Button (OPEN/CLOSED)
- `http://localhost:8092/state` liefert JSON mit aktuellem Kontaktzustand

### Virtueller Bewegungsmelder

- URL: `http://localhost:8093`
- Mausbewegungen auf der Seite lösen Bewegungsereignisse aus
- `http://localhost:8093/state` liefert JSON mit aktuellem Bewegungszustand

### Virtuelles MQTT-Thermostat

- URL: `http://localhost:8094`
- Zeigt aktuelle Temperatur, Zieltemperatur und HVAC-Modus
- Hintergrundfarbe codiert die aktuelle Temperatur:
  - Tiefblau bei `<10 C`
  - Dunkelrot bei `>30 C`
  - Dazwischen weicher Verlauf über cyan/grün/gelb/orange
- `http://localhost:8094/state` liefert JSON mit `currentTemp`, `targetTemp`, `hvacMode`
- `http://localhost:8094/health` für Healthchecks

Damit die Seiten erreichbar sind, muss der Stack mit aktueller Compose-Datei gestartet sein.

## Fenstersensor invertieren

Die Logik des Fensterkontakts kann über `CONTACT_INVERTED` umgedreht werden.

In `docker-compose.yml` beim Service `virtual-contact-sensor`:

```yaml
environment:
  - CONTACT_INVERTED=true
```

Bedeutung:

- `true`: UI-Status wird für Matter invertiert gemeldet
- `false`: UI-Status und Matter-Status sind gleich

Nach Änderung:

```bash
docker compose up -d --build virtual-contact-sensor
```

## Home Assistant Automationen und Konfiguration

Damit Automationen geladen werden, muss die `configuration.yaml` die Includes enthalten:

```yaml
default_config:

automation: !include automations.yaml
script: !include scripts.yaml
scene: !include scenes.yaml
```

Außerdem müssen `scripts.yaml` und `scenes.yaml` existieren (dürfen leer sein).

Beispiel-Automation:

- Trigger: Fensterkontakt wird geöffnet
- Action: Thermostat HVAC-Modus auf `off`

## Troubleshooting

### Automation gespeichert, aber Zeitüberschreitung bei Einrichtung

Symptom:

- Home Assistant meldet beim Speichern einer Automation eine Zeitüberschreitung.

Prüfen:

1. In Entwicklerwerkzeuge > YAML, ob Konfiguration gültig ist.
2. Ob die Includes in `configuration.yaml` gesetzt sind.
3. Ob `scripts.yaml` und `scenes.yaml` vorhanden sind.
4. Home Assistant neu starten oder Automationen neu laden.

Hilfreiche Befehle:

```bash
docker compose restart homeassistant
docker compose logs --tail=200 homeassistant
```

### MQTT-Thermostat erscheint nicht

1. MQTT-Integration in Home Assistant prüfen.
2. Broker-Adresse `mqtt-broker:1883` prüfen.
3. Logs prüfen:

```bash
docker compose logs -f mqtt-broker
docker compose logs -f virtual-thermostat-mqtt
```

## Stoppen

```bash
docker compose down
```

Mit Persistenzdaten entfernen:

```bash
docker compose down -v
```

## Neustart und Pairing-Verhalten

- Der Pairingcode ändert sich nicht, solange `MATTER_PASSCODE` und `MATTER_DISCRIMINATOR` gleich bleiben.
- Entscheidend ist der persistente Gerätespeicher (Volume nach `/root/.matter`).
- Ohne diesen Speicher wirkt das jeweilige Matter-Gerät nach Container-Neuerstellung wie ein neues, unkommissioniertes Gerät.
- Mit aktivem Volume bleibt die Kommissionierung auf demselben Fabric nach Neustarts erhalten.

Falls du absichtlich neu pairen willst (Factory Reset):

```bash
docker compose down
rm -rf virtual-light-data
rm -rf virtual-rgb-light-data
rm -rf virtual-contact-sensor-data
rm -rf virtual-occupancy-sensor-data
docker compose up -d --build
```

Danach in Home Assistant ggf. alte Device-Einträge entfernen und erneut koppeln.

## Hinweise

- Der Prototyp nutzt softwarebasierte Geräte (ohne physische Hardware).
- Die Architektur demonstriert Verteilung, lose Kopplung und Erweiterbarkeit durch getrennte Container.
- Weitere virtuelle Matter- oder MQTT-Geräte können analog als eigener Service ergänzt werden.


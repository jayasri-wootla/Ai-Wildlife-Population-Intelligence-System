import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;

/* =========================================================
   ICONS
========================================================= */

const dotIcon = (color, size = 14) =>
  L.divIcon({
    className: "gis-dot-icon",
    html: `
      <span style="
        display:block;
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        background:${color};
        border:2px solid #fff;
        box-shadow:0 0 0 1px ${color}, 0 2px 6px rgba(0,0,0,0.35);
      "></span>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });

const SITE_ICON = dotIcon("#0f8a5f", 16);
const CAMERA_ICON = dotIcon("#3a7bd5", 14);
const OBSERVATION_ICON = dotIcon("#8e44ad", 14);
const AUDIO_ICON = dotIcon("#f39c12", 14);
const ALERT_ICON = dotIcon("#e74c3c", 16);

/* =========================================================
   HELPERS
========================================================= */

function validCoordinate(lat, lng) {
  if (
    lat === null ||
    lat === undefined ||
    lng === null ||
    lng === undefined ||
    lat === "" ||
    lng === ""
  ) {
    return false;
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "—";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*
 * When multiple devices/observations have exactly the same
 * coordinates, slightly separate their markers so they can
 * all be seen.
 */
function spread(lat, lng, occurrence) {
  if (occurrence === 0) return [lat, lng];

  const angle = (occurrence * 137.5 * Math.PI) / 180;
  const radius = 0.0006 * occurrence;

  return [
    lat + radius * Math.cos(angle),
    lng + radius * Math.sin(angle),
  ];
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function GISOverviewMap({
  sites = [],
  cameraTraps = [],
  observations = [],
  audioSensors = [],
  alerts = [],
  onSiteSelect,
  height = 500,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const baseLayerRef = useRef(null);

  /* Layer visibility */
  const [showSites, setShowSites] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [showObservations, setShowObservations] = useState(true);
  const [showAudioSensors, setShowAudioSensors] = useState(true);
  const [showDensity, setShowDensity] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  /* Filter */
  const [selectedSpecies, setSelectedSpecies] = useState("all");

  /* Base map */
  const [satelliteMode, setSatelliteMode] = useState(false);

  /* =========================================================
     UNIQUE SPECIES
  ========================================================= */

  const speciesList = useMemo(() => {
    const names = observations
      .map((obs) => obs.species_name)
      .filter(Boolean)
      .map((name) => String(name).trim())
      .filter(Boolean);

    return [...new Set(names)].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [observations]);

  /* =========================================================
     COUNTS
  ========================================================= */

  const validSites = sites.filter((site) =>
    validCoordinate(site.latitude, site.longitude)
  );

  const validCameras = cameraTraps.filter((trap) => {
    const site = sites.find(
      (s) => String(s.id) === String(trap.monitoring_site_id)
    );

    return (
      site &&
      validCoordinate(site.latitude, site.longitude)
    );
  });

  const validAudioSensors = audioSensors.filter((sensor) => {
    const site = sites.find(
      (s) => String(s.id) === String(sensor.monitoring_site_id)
    );

    return (
      site &&
      validCoordinate(site.latitude, site.longitude)
    );
  });

  const filteredObservations = observations.filter((obs) => {
    if (selectedSpecies === "all") return true;

    return (
      String(obs.species_name || "").trim() ===
      selectedSpecies
    );
  });

  /* =========================================================
     CREATE MAP
  ========================================================= */

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    const streetLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }
    );

    streetLayer.addTo(map);

    baseLayerRef.current = streetLayer;

    layerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  /* =========================================================
     CHANGE BASE MAP
  ========================================================= */

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }

    let newLayer;

    if (satelliteMode) {
      newLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri",
          maxZoom: 19,
        }
      );
    } else {
      newLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }
      );
    }

    newLayer.addTo(map);

    baseLayerRef.current = newLayer;
  }, [satelliteMode]);

  /* =========================================================
     DRAW GIS DATA
  ========================================================= */

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;

    if (!map || !layer) return;

    layer.clearLayers();

    const siteById = Object.fromEntries(
      sites.map((site) => [String(site.id), site])
    );

    const seen = {};
    const bounds = [];

    /*
     * Add a marker.
     */
    const place = (
      lat,
      lng,
      icon,
      popupHtml,
      onClick = null
    ) => {
      const latitude = Number(lat);
      const longitude = Number(lng);

      if (!validCoordinate(latitude, longitude)) return;

      const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

      const occurrence = seen[key] || 0;
      seen[key] = occurrence + 1;

      const [plotLat, plotLng] = spread(
        latitude,
        longitude,
        occurrence
      );

      const marker = L.marker(
        [plotLat, plotLng],
        { icon }
      )
        .bindPopup(popupHtml)
        .addTo(layer);

      if (onClick) {
        marker.on("click", onClick);
      }

      bounds.push([plotLat, plotLng]);
    };

    /* =====================================================
       1. MONITORING SITES
    ===================================================== */

    if (showSites) {
      validSites.forEach((site) => {
        const siteObservationCount =
          observations.filter(
            (obs) =>
              String(obs.monitoring_site_id) ===
              String(site.id)
          ).length;

        const siteCameraCount =
          cameraTraps.filter(
            (trap) =>
              String(trap.monitoring_site_id) ===
              String(site.id)
          ).length;

        const siteAudioCount =
          audioSensors.filter(
            (sensor) =>
              String(sensor.monitoring_site_id) ===
              String(site.id)
          ).length;

        const popup = `
          <div style="min-width:220px">
            <h3 style="margin:0 0 8px 0">
              ${escapeHtml(
                site.site_name || "Unnamed Site"
              )}
            </h3>

            <div>
              <strong>Type:</strong>
              Monitoring Site
            </div>

            <div>
              <strong>Habitat:</strong>
              ${escapeHtml(site.habitat_type)}
            </div>

            <div>
              <strong>Protected Area:</strong>
              ${escapeHtml(site.protected_area)}
            </div>

            <hr style="margin:8px 0"/>

            <div>
              🐾 Observations:
              <strong>${siteObservationCount}</strong>
            </div>

            <div>
              📷 Camera Traps:
              <strong>${siteCameraCount}</strong>
            </div>

            <div>
              🎙 Audio Sensors:
              <strong>${siteAudioCount}</strong>
            </div>

            <hr style="margin:8px 0"/>

            <div>
              📍 ${Number(site.latitude).toFixed(5)},
              ${Number(site.longitude).toFixed(5)}
            </div>
          </div>
        `;

        place(
          site.latitude,
          site.longitude,
          SITE_ICON,
          popup,
          onSiteSelect
            ? () => onSiteSelect(site)
            : null
        );
      });
    }

    /* =====================================================
       2. CAMERA TRAPS
    ===================================================== */

    if (showCameras) {
      cameraTraps.forEach((trap) => {
        const site =
          siteById[
            String(trap.monitoring_site_id)
          ];

        if (
          !site ||
          !validCoordinate(
            site.latitude,
            site.longitude
          )
        ) {
          return;
        }

        const battery =
          trap.battery_level !== null &&
          trap.battery_level !== undefined
            ? `${trap.battery_level}%`
            : "—";

        const popup = `
          <div style="min-width:210px">
            <h3 style="margin:0 0 8px 0">
              📷 ${escapeHtml(
                trap.device_code ||
                  "Camera Trap"
              )}
            </h3>

            <div>
              <strong>Status:</strong>
              ${escapeHtml(trap.status)}
            </div>

            <div>
              <strong>Battery:</strong>
              ${battery}
            </div>

            <div>
              <strong>Monitoring Site:</strong>
              ${escapeHtml(site.site_name)}
            </div>
          </div>
        `;

        place(
          site.latitude,
          site.longitude,
          CAMERA_ICON,
          popup
        );
      });
    }

    /* =====================================================
       3. AUDIO SENSORS
    ===================================================== */

    if (showAudioSensors) {
      audioSensors.forEach((sensor) => {
        const site =
          siteById[
            String(sensor.monitoring_site_id)
          ];

        if (
          !site ||
          !validCoordinate(
            site.latitude,
            site.longitude
          )
        ) {
          return;
        }

        const popup = `
          <div style="min-width:210px">
            <h3 style="margin:0 0 8px 0">
              🎙 ${escapeHtml(
                sensor.device_code ||
                  "Audio Sensor"
              )}
            </h3>

            <div>
              <strong>Model:</strong>
              ${escapeHtml(sensor.model_name)}
            </div>

            <div>
              <strong>Status:</strong>
              ${escapeHtml(sensor.status)}
            </div>

            <div>
              <strong>Battery:</strong>
              ${
                sensor.battery_level !==
                  null &&
                sensor.battery_level !==
                  undefined
                  ? `${sensor.battery_level}%`
                  : "—"
              }
            </div>

            <div>
              <strong>Site:</strong>
              ${escapeHtml(site.site_name)}
            </div>
          </div>
        `;

        place(
          site.latitude,
          site.longitude,
          AUDIO_ICON,
          popup
        );
      });
    }

    /* =====================================================
       4. SPECIES OBSERVATIONS
    ===================================================== */

    if (showObservations) {
      filteredObservations.forEach((obs) => {
        const site =
          siteById[
            String(obs.monitoring_site_id)
          ];

        if (
          !site ||
          !validCoordinate(
            site.latitude,
            site.longitude
          )
        ) {
          return;
        }

        const popup = `
          <div style="min-width:210px">
            <h3 style="margin:0 0 8px 0">
              🐾 ${escapeHtml(
                obs.species_name ||
                  "Unknown Species"
              )}
            </h3>

            <div>
              <strong>Observation Type:</strong>
              ${escapeHtml(
                obs.observation_type
              )}
            </div>

            <div>
              <strong>Monitoring Site:</strong>
              ${escapeHtml(site.site_name)}
            </div>

            ${
              obs.notes
                ? `
                  <div style="margin-top:6px">
                    <strong>Notes:</strong>
                    ${escapeHtml(obs.notes)}
                  </div>
                `
                : ""
            }
          </div>
        `;

        place(
          site.latitude,
          site.longitude,
          OBSERVATION_ICON,
          popup
        );
      });
    }

    /* =====================================================
       5. DETECTION DENSITY
       
       This is based on observation count per site.
       It is NOT an actual population estimate.
    ===================================================== */

    if (showDensity) {
      const observationCountBySite = {};

      filteredObservations.forEach((obs) => {
        const siteId = String(
          obs.monitoring_site_id
        );

        observationCountBySite[siteId] =
          (observationCountBySite[siteId] || 0) +
          1;
      });

      Object.entries(
        observationCountBySite
      ).forEach(([siteId, count]) => {
        const site = siteById[siteId];

        if (
          !site ||
          !validCoordinate(
            site.latitude,
            site.longitude
          )
        ) {
          return;
        }

        /*
         * Larger number of observations =
         * larger circle.
         */
        const radius = Math.min(
          10000,
          Math.max(
            400,
            count * 700
          )
        );

        const circle = L.circle(
          [
            Number(site.latitude),
            Number(site.longitude),
          ],
          {
            radius,
            fillOpacity: 0.18,
            weight: 2,
            dashArray: "5, 5",
          }
        );

        circle
          .bindPopup(`
            <div style="min-width:190px">
              <h3 style="margin:0 0 8px 0">
                Detection Density
              </h3>

              <div>
                <strong>Site:</strong>
                ${escapeHtml(site.site_name)}
              </div>

              <div>
                <strong>Species Observations:</strong>
                ${count}
              </div>

              <div style="margin-top:7px;font-size:12px">
                Larger circles indicate more
                recorded observations.
              </div>
            </div>
          `)
          .addTo(layer);

        bounds.push([
          Number(site.latitude),
          Number(site.longitude),
        ]);
      });
    }

    /* =====================================================
       6. ALERT LOCATIONS
       
       If alerts contain monitoring_site_id,
       they will be shown at the linked site.
    ===================================================== */

    if (showAlerts) {
      alerts.forEach((alert) => {
        const site =
          siteById[
            String(alert.monitoring_site_id)
          ];

        if (
          !site ||
          !validCoordinate(
            site.latitude,
            site.longitude
          )
        ) {
          return;
        }

        const popup = `
          <div style="min-width:210px">
            <h3 style="margin:0 0 8px 0">
              ⚠ Wildlife Alert
            </h3>

            <div>
              <strong>Type:</strong>
              ${escapeHtml(
                alert.alert_type ||
                  alert.type ||
                  "Alert"
              )}
            </div>

            <div>
              <strong>Severity:</strong>
              ${escapeHtml(
                alert.severity ||
                  alert.priority ||
                  "—"
              )}
            </div>

            <div>
              <strong>Site:</strong>
              ${escapeHtml(site.site_name)}
            </div>
          </div>
        `;

        place(
          site.latitude,
          site.longitude,
          ALERT_ICON,
          popup
        );
      });
    }

    /* =====================================================
       FIT MAP TO DATA
    ===================================================== */

    if (bounds.length > 0) {
      map.fitBounds(
        L.latLngBounds(bounds),
        {
          padding: [45, 45],
          maxZoom: 12,
        }
      );
    }
  }, [
    sites,
    cameraTraps,
    observations,
    audioSensors,
    alerts,
    filteredObservations,
    showSites,
    showCameras,
    showObservations,
    showAudioSensors,
    showDensity,
    showAlerts,
    onSiteSelect,
    validSites
  ]);

  /* =========================================================
     FLY TO SELECTED SPECIES
  ========================================================= */

  const handleSpeciesChange = (e) => {
    const value = e.target.value;

    setSelectedSpecies(value);

    if (
      value === "all" ||
      !mapRef.current
    ) {
      return;
    }

    const selected = observations.filter(
      (obs) =>
        String(obs.species_name || "").trim() ===
        value
    );

    const siteById = Object.fromEntries(
      sites.map((site) => [
        String(site.id),
        site,
      ])
    );

    const coords = selected
      .map(
        (obs) =>
          siteById[
            String(obs.monitoring_site_id)
          ]
      )
      .filter(
        (site) =>
          site &&
          validCoordinate(
            site.latitude,
            site.longitude
          )
      )
      .map((site) => [
        Number(site.latitude),
        Number(site.longitude),
      ]);

    if (coords.length > 0) {
      mapRef.current.fitBounds(
        L.latLngBounds(coords),
        {
          padding: [50, 50],
          maxZoom: 13,
        }
      );
    }
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div>
      {/* ===================================================
          GIS SUMMARY
      =================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(120px,1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#eef8f3",
            border: "1px solid #d7eee3",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {validSites.length}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
            }}
          >
            Monitoring Sites
          </div>
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#eef5ff",
            border: "1px solid #d8e6fb",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {validCameras.length}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
            }}
          >
            Camera Traps
          </div>
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#f6effb",
            border: "1px solid #eadcf4",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {filteredObservations.length}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
            }}
          >
            Observations
          </div>
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#fff7e8",
            border: "1px solid #f4e3bf",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {validAudioSensors.length}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
            }}
          >
            Audio Sensors
          </div>
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#fff0f0",
            border: "1px solid #f3d5d5",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {alerts.length}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
            }}
          >
            Alerts
          </div>
        </div>
      </div>

      {/* ===================================================
          FILTERS
      =================================================== */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Species:
        </label>

        <select
          value={selectedSpecies}
          onChange={handleSpeciesChange}
          style={{
            padding: "7px 10px",
            borderRadius: 7,
            border: "1px solid #d5d5d5",
            minWidth: 170,
          }}
        >
          <option value="all">
            All Species
          </option>

          {speciesList.map((species) => (
            <option
              key={species}
              value={species}
            >
              {species}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() =>
            setSatelliteMode(
              (previous) => !previous
            )
          }
          style={{
            padding: "7px 12px",
            borderRadius: 7,
            border: "1px solid #d5d5d5",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          {satelliteMode
            ? "🗺️ Street Map"
            : "🛰️ Satellite"}
        </button>
      </div>

      {/* ===================================================
          LAYER CONTROLS
      =================================================== */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showSites}
            onChange={(e) =>
              setShowSites(
                e.target.checked
              )
            }
          />

          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#0f8a5f",
              display: "inline-block",
            }}
          />

          Sites ({validSites.length})
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showCameras}
            onChange={(e) =>
              setShowCameras(
                e.target.checked
              )
            }
          />

          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#3a7bd5",
              display: "inline-block",
            }}
          />

          Cameras ({validCameras.length})
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showObservations}
            onChange={(e) =>
              setShowObservations(
                e.target.checked
              )
            }
          />

          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#8e44ad",
              display: "inline-block",
            }}
          />

          Observations ({filteredObservations.length})
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showAudioSensors}
            onChange={(e) =>
              setShowAudioSensors(
                e.target.checked
              )
            }
          />

          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f39c12",
              display: "inline-block",
            }}
          />

          Audio ({validAudioSensors.length})
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showDensity}
            onChange={(e) =>
              setShowDensity(
                e.target.checked
              )
            }
          />

          🟡 Detection Density
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showAlerts}
            onChange={(e) =>
              setShowAlerts(
                e.target.checked
              )
            }
          />

          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#e74c3c",
              display: "inline-block",
            }}
          />

          Alerts ({alerts.length})
        </label>
      </div>

      {/* ===================================================
          MAP
      =================================================== */}

      <div
        ref={containerRef}
        style={{
          height,
          width: "100%",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid #e3e3e3",
        }}
      />

      {/* ===================================================
          LEGEND
      =================================================== */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginTop: 10,
          fontSize: 12,
          opacity: 0.85,
        }}
      >
        <span>🟢 Monitoring Site</span>
        <span>🔵 Camera Trap</span>
        <span>🟣 Species Observation</span>
        <span>🟠 Audio Sensor</span>
        <span>🟡 Detection Density</span>
        <span>🔴 Alert</span>
      </div>
    </div>
  );
}

export default GISOverviewMap;
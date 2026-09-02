import React, {
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../api/axios";
import DashboardLayout from "../components/DashboardLayout";
import GISOverviewMap from "../components/GISOverviewMap";
import { AuthContext } from "../context/AuthContext";
import { PinIcon } from "../components/Icons";

const emptyForm = {
  survey_id: "",
  site_name: "",
  latitude: "",
  longitude: "",
  habitat_type: "",
  protected_area: "",
  monitoring_device: "",
};

function MonitoringSites() {
  const { user } = useContext(AuthContext);

  const canEdit = [
    "wildlife_researcher",
    "administrator",
    "forest_officer",
  ].includes(user?.role);

  const [sites, setSites] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [cameraTraps, setCameraTraps] = useState([]);

  /* NEW GIS DATA */
  const [observations, setObservations] = useState([]);
  const [audioSensors, setAudioSensors] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [selectedSite, setSelectedSite] =
    useState(null);

  const [editingSiteId, setEditingSiteId] =
    useState(null);

  const [formData, setFormData] =
    useState(emptyForm);

  /* =====================================================
     LOAD DATA
  ===================================================== */

  useEffect(() => {
    loadSites();
    loadSurveys();
    loadCameraTraps();
    loadObservations();
    loadAudioSensors();
    loadAlerts();
  }, []);

  const loadSites = () => {
    api
      .get("/monitoring-sites/")
      .then((res) => setSites(res.data))
      .catch((err) =>
        console.log(
          "Monitoring sites error:",
          err
        )
      );
  };

  const loadSurveys = () => {
    api
      .get("/surveys/")
      .then((res) => setSurveys(res.data))
      .catch((err) =>
        console.log(
          "Surveys error:",
          err
        )
      );
  };

  const loadCameraTraps = () => {
    api
      .get("/camera-traps/")
      .then((res) =>
        setCameraTraps(res.data)
      )
      .catch((err) =>
        console.log(
          "Camera traps error:",
          err
        )
      );
  };

  /* =====================================================
     LOAD OBSERVATIONS
  ===================================================== */

  const loadObservations = () => {
    api
      .get("/observations/")
      .then((res) =>
        setObservations(
          Array.isArray(res.data)
            ? res.data
            : []
        )
      )
      .catch((err) => {
        console.log(
          "Observations error:",
          err
        );

        /*
         * Do not break the GIS if the endpoint
         * is unavailable.
         */
        setObservations([]);
      });
  };

  /* =====================================================
     LOAD AUDIO SENSORS
  ===================================================== */

  const loadAudioSensors = () => {
    api
      .get("/audio-sensors/")
      .then((res) =>
        setAudioSensors(
          Array.isArray(res.data)
            ? res.data
            : []
        )
      )
      .catch((err) => {
        console.log(
          "Audio sensors error:",
          err
        );

        setAudioSensors([]);
      });
  };

  /* =====================================================
     LOAD ALERTS
  ===================================================== */

  const loadAlerts = () => {
    api
      .get("/alerts/")
      .then((res) =>
        setAlerts(
          Array.isArray(res.data)
            ? res.data
            : []
        )
      )
      .catch((err) => {
        console.log(
          "Alerts endpoint unavailable:",
          err
        );

        /*
         * Your current backend may not have
         * /alerts/ yet. In that case GIS simply
         * displays zero alerts instead of crashing.
         */
        setAlerts([]);
      });
  };

  /* =====================================================
     FORM
  ===================================================== */

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (editingSiteId) {
      const {
        survey_id,
        ...updatePayload
      } = formData;

      api
        .put(
          `/monitoring-sites/${editingSiteId}`,
          updatePayload
        )
        .then(() => {
          alert(
            "Monitoring Site Updated ✅"
          );

          cancelEdit();
          loadSites();
        })
        .catch((err) => {
          console.log(err);

          alert(
            err.response?.data?.detail ||
              "Update failed ❌"
          );
        });
    } else {
      api
        .post(
          "/monitoring-sites/",
          formData
        )
        .then(() => {
          alert(
            "Monitoring Site Created ✅"
          );

          setFormData(emptyForm);
          loadSites();
        })
        .catch((err) => {
          console.log(err);

          alert(
            err.response?.data?.detail ||
              "Creation failed ❌"
          );
        });
    }
  };

  /* =====================================================
     EDIT
  ===================================================== */

  const startEdit = (site) => {
    setEditingSiteId(site.id);

    setFormData({
      survey_id: site.survey_id,
      site_name:
        site.site_name || "",
      latitude:
        site.latitude ?? "",
      longitude:
        site.longitude ?? "",
      habitat_type:
        site.habitat_type || "",
      protected_area:
        site.protected_area || "",
      monitoring_device:
        site.monitoring_device || "",
    });
  };

  const cancelEdit = () => {
    setEditingSiteId(null);
    setFormData(emptyForm);
  };

  /* =====================================================
     DELETE
  ===================================================== */

  const handleDelete = (siteId) => {
    if (
      !window.confirm(
        "Delete this monitoring site? This cannot be undone."
      )
    ) {
      return;
    }

    api
      .delete(
        `/monitoring-sites/${siteId}`
      )
      .then(() => {
        alert(
          "Monitoring Site Deleted ✅"
        );

        if (
          selectedSite?.id === siteId
        ) {
          setSelectedSite(null);
        }

        if (
          editingSiteId === siteId
        ) {
          cancelEdit();
        }

        loadSites();
        loadCameraTraps();
        loadObservations();
        loadAudioSensors();
      })
      .catch((err) => {
        console.log(err);

        alert(
          err.response?.data?.detail ||
            "Delete failed ❌"
        );
      });
  };

  /* =====================================================
     MISSING COORDINATES
  ===================================================== */

  const missingCoordSites =
    sites.filter(
      (s) =>
        s.latitude == null ||
        s.longitude == null ||
        s.latitude === "" ||
        s.longitude === ""
    );

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <DashboardLayout title="Monitoring Sites">
      {/* =================================================
          GIS PANEL
      ================================================= */}

      <div
        className="panel"
        style={{
          marginBottom: 22,
        }}
      >
        <div className="panel-title">
          Wildlife GIS Intelligence Map
        </div>

        <p
          style={{
            marginTop: -4,
            marginBottom: 14,
            fontSize: 13,
            color: "var(--dl-text-dim)",
          }}
        >
          Visualize monitoring sites,
          camera traps, species observations,
          audio sensors and wildlife detection
          density in one map.
        </p>

        {missingCoordSites.length > 0 && (
          <div
            className="info-note"
            style={{
              marginBottom: 14,
              marginTop: -4,
            }}
          >
            ⚠{" "}
            {missingCoordSites.length} site
            {missingCoordSites.length > 1
              ? "s are"
              : " is"}{" "}
            missing latitude/longitude and{" "}
            {missingCoordSites.length > 1
              ? "aren't"
              : "isn't"}{" "}
            shown on the map:{" "}
            <strong>
              {missingCoordSites
                .map(
                  (s) => s.site_name
                )
                .join(", ")}
            </strong>
            . Edit the site below to
            add coordinates.
          </div>
        )}

        <GISOverviewMap
          sites={sites}
          cameraTraps={cameraTraps}
          observations={observations}
          audioSensors={audioSensors}
          alerts={alerts}
          onSiteSelect={setSelectedSite}
          height={520}
        />
      </div>

      {/* =================================================
          LOWER PANELS
      ================================================= */}

      <div className="dl-panels">
        {/* =================================================
            ALL SITES
        ================================================= */}

        <div className="panel">
          <div className="panel-title">
            All Sites ({sites.length})
          </div>

          {sites.length === 0 && (
            <p
              style={{
                color:
                  "var(--dl-text-dim)",
                fontSize: 13.5,
              }}
            >
              No monitoring sites yet.
            </p>
          )}

          {sites.map((site) => {
            const hasCoords =
              site.latitude != null &&
              site.longitude != null &&
              site.latitude !== "" &&
              site.longitude !== "";

            return (
              <div
                key={site.id}
                className="site-row"
                onClick={() =>
                  setSelectedSite(site)
                }
              >
                <span className="site-row-icon">
                  <PinIcon size={16} />
                </span>

                <div className="site-row-info">
                  <span className="site-row-name">
                    {site.site_name}
                  </span>

                  {site.habitat_type && (
                    <span className="status-badge unknown">
                      {site.habitat_type}
                    </span>
                  )}

                  {!hasCoords && (
                    <span
                      className="status-badge endangered"
                      style={{
                        marginLeft: 6,
                      }}
                    >
                      No location set
                    </span>
                  )}
                </div>

                {canEdit && (
                  <div
                    className="site-row-actions"
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        startEdit(site)
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        handleDelete(
                          site.id
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* =================================================
              SELECTED SITE
          ================================================= */}

          {selectedSite && (
            <div className="site-detail-card">
              <div
                className="panel-title"
                style={{
                  marginBottom: 10,
                }}
              >
                Site Details
              </div>

              <p>
                <strong>
                  Site Name:
                </strong>{" "}
                {selectedSite.site_name}
              </p>

              <p>
                <strong>
                  Habitat Type:
                </strong>{" "}
                {selectedSite.habitat_type ||
                  "—"}
              </p>

              <p>
                <strong>
                  Latitude:
                </strong>{" "}
                {selectedSite.latitude ||
                  "—"}
              </p>

              <p>
                <strong>
                  Longitude:
                </strong>{" "}
                {selectedSite.longitude ||
                  "—"}
              </p>

              <p>
                <strong>
                  Protected Area:
                </strong>{" "}
                {selectedSite.protected_area ||
                  "—"}
              </p>

              <p>
                <strong>
                  Monitoring Device:
                </strong>{" "}
                {selectedSite.monitoring_device ||
                  "—"}
              </p>
            </div>
          )}
        </div>

        {/* =================================================
            CREATE / EDIT
        ================================================= */}

        {canEdit && (
          <div className="panel">
            <div className="panel-title">
              {editingSiteId
                ? "Edit Monitoring Site"
                : "Create Monitoring Site"}
            </div>

            <form
              onSubmit={handleSubmit}
            >
              <select
                name="survey_id"
                value={
                  formData.survey_id
                }
                onChange={
                  handleChange
                }
                required
                disabled={
                  !!editingSiteId
                }
              >
                <option value="">
                  Select Survey
                </option>

                {surveys.map(
                  (survey) => (
                    <option
                      key={survey.id}
                      value={survey.id}
                    >
                      {survey.title}
                    </option>
                  )
                )}
              </select>

              <input
                type="text"
                name="site_name"
                placeholder="Site Name"
                value={
                  formData.site_name
                }
                onChange={
                  handleChange
                }
                required
              />

              <div className="form-row-2col">
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  placeholder="Latitude"
                  value={
                    formData.latitude
                  }
                  onChange={
                    handleChange
                  }
                  required
                />

                <input
                  type="number"
                  step="any"
                  name="longitude"
                  placeholder="Longitude"
                  value={
                    formData.longitude
                  }
                  onChange={
                    handleChange
                  }
                  required
                />
              </div>

              <input
                type="text"
                name="habitat_type"
                placeholder="Habitat Type"
                value={
                  formData.habitat_type
                }
                onChange={
                  handleChange
                }
              />

              <input
                type="text"
                name="protected_area"
                placeholder="Protected Area"
                value={
                  formData.protected_area
                }
                onChange={
                  handleChange
                }
              />

              <input
                type="text"
                name="monitoring_device"
                placeholder="Monitoring Device"
                value={
                  formData.monitoring_device
                }
                onChange={
                  handleChange
                }
              />

              <div
                style={{
                  display: "flex",
                  gap: 10,
                }}
              >
                <button type="submit">
                  {editingSiteId
                    ? "Save Changes"
                    : "Create Monitoring Site"}
                </button>

                {editingSiteId && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={
                      cancelEdit
                    }
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default MonitoringSites;
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import DashboardLayout from "../components/DashboardLayout";

function AnimalCounting() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const API_URL = "https://ai-wildlife-population-intelligence.onrender.com";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/animal-counting/detect", formData);
      setResult(res.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Detection failed. Make sure the backend and YOLO model are available."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Animal Counting">
      <div className="panel">
        <button
          type="button"
          className="secondary"
          onClick={() => navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          ← Back
        </button>

        <div className="panel-title">
          Animal Counting (Object Detection)
        </div>

        <p style={{ color: "var(--dl-text)" }}>
          Upload an image to detect and count animals using YOLOv8. This counts
          animal-shaped objects and draws bounding boxes — it does not identify
          specific species (use Image Analysis for species identification).
        </p>

        <p className="panel-subtitle" style={{ marginTop: 0 }}>
          Supported categories: bird, cat, dog, horse, sheep, cow, elephant,
          bear, zebra, giraffe. Other species (e.g. rhino, buffalo) won't be
          detected by this generic model.
        </p>

        <form onSubmit={handleSubmit} style={{ maxWidth: "420px" }}>
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <button type="submit" disabled={!file || loading}>
            {loading ? "Detecting..." : "Count Animals"}
          </button>
        </form>

        {error && (
          <p style={{ color: "var(--dl-red)" }}>
            {error}
          </p>
        )}

        {result && (
          <div style={{ marginTop: "20px" }}>
            <div className="panel-title">
              Result: {result.animal_count} animal
              {result.animal_count !== 1 ? "s" : ""} detected
            </div>

            <img
              src={`${API_URL}${result.annotated_image_url}`}
              alt="Annotated detection"
              style={{
                maxWidth: "100%",
                borderRadius: "8px",
                border: "1px solid var(--dl-border)",
                marginTop: "12px",
              }}
            />

            {result.detections.length > 0 && (
              <table
                className="dl-table"
                style={{ marginTop: "16px" }}
              >
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Confidence</th>
                  </tr>
                </thead>

                <tbody>
                  {result.detections.map((d, i) => (
                    <tr key={i}>
                      <td>{d.class_name}</td>
                      <td>
                        {(d.confidence * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AnimalCounting;
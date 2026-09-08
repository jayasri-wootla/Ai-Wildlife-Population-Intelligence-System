from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base

# ============================================================
# Import Models
# ============================================================

from app.models import user
from app.models import survey
from app.models import monitoring_site
from app.models import camera_trap
from app.models import audio_sensor
from app.models import observation
from app.models import species_catalog
from app.models import image_dataset
from app.models import species_prediction
from app.models import audio_prediction


# ============================================================
# Import Routers
# ============================================================

from app.api.routes.auth import router as auth_router
from app.api.routes.surveys import router as survey_router
from app.api.routes.monitoring_sites import router as monitoring_site_router
from app.api.routes.camera_traps import router as camera_trap_router
from app.api.routes.audio_sensors import router as audio_sensor_router
from app.api.routes.observations import router as observation_router
from app.api.routes.datasets import router as datasets_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.image_analysis import router as image_analysis_router
from app.api.routes.bioacoustics import router as bioacoustics_router
from app.api.routes.biodiversity import router as biodiversity_router
from app.api.routes.reports import router as reports_router
from app.api.routes.user_activity import router as user_activity_router
from app.api.routes.population import router as population_router
from app.api.routes.habitat import router as habitat_router
from app.api.routes.ecosystem_health import router as ecosystem_health_router
from app.api.routes.conservation_recommendations import (
    router as conservation_recommendations_router
)
from app.api.routes.animal_counting import router as animal_counting_router


# ============================================================
# Create FastAPI Application
# ============================================================

app = FastAPI(
    title="Wildlife Population Intelligence System"
)


# ============================================================
# CORS Configuration
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local React frontend
        "http://localhost:3000",

        # Deployed Vercel frontend
        "https://wildlife-frontend-swart.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Database Startup
# ============================================================

@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)


# ============================================================
# Include API Routers
# ============================================================

app.include_router(auth_router)
app.include_router(survey_router)
app.include_router(monitoring_site_router)
app.include_router(camera_trap_router)
app.include_router(audio_sensor_router)
app.include_router(observation_router)
app.include_router(datasets_router)
app.include_router(analytics_router)
app.include_router(image_analysis_router)
app.include_router(bioacoustics_router)
app.include_router(biodiversity_router)
app.include_router(reports_router)
app.include_router(user_activity_router)
app.include_router(population_router)
app.include_router(habitat_router)
app.include_router(ecosystem_health_router)
app.include_router(conservation_recommendations_router)
app.include_router(animal_counting_router)


# ============================================================
# Root Endpoint
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Backend + Database connected ✅"
    }
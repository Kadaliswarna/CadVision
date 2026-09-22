"""
iQOO CADVision - FastAPI Backend Application
Main entry point for computer vision, CAD intermediate representation, and DXF generation.
"""

import sys
import os

# Ensure the backend directory is in sys.path so 'import app...' works regardless of invocation directory
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.router import router
from app.db.database import init_db
from app.cad.dxf_exporter import EXPORT_DIR

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="iQOO CADVision API",
    description="Real-World Object -> Phone/Web Camera -> Computer Vision -> Structured CAD -> AutoCAD DXF",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Web Dashboard and Android App
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs(EXPORT_DIR, exist_ok=True)

# Include CADVision API router
app.include_router(router)

@app.get("/")
def root():
    return {
        "app": "iQOO CADVision",
        "description": "Real-World Object to Intelligent AutoCAD Drawing Engine",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "online"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

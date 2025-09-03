import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Import services
from app.core.config import config_manager
from app.services.modbus_service import modbus_service
from app.api.routes import config_routes, data_routes, auth_routes, websocket_routes

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Load configuration
    config_manager.load_config()
    
    # Initialize services
    print("🚀 Starting CEMS Backend...")
    
    yield

    # Cleanup
    await modbus_service.close_all()
    print("🛑 CEMS Backend stopped")

# Create FastAPI app
app = FastAPI(
    title="CEMS Backend",
    description="Continuous Emission Monitoring System Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(config_routes.router, prefix="/config", tags=["config"])
app.include_router(data_routes.router, prefix="/api/data", tags=["data"])
app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(websocket_routes.router, prefix="/ws", tags=["websocket"])

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok", 
        "timestamp": asyncio.get_event_loop().time(),
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint - Home page data"""
    return config_manager.config

if __name__ == "__main__":
    print("=" * 50)
    print("🔗 CEMS Backend Starting...")
    print("🔗 API: http://127.0.0.1:8000")
    print("🔗 Health: http://127.0.0.1:8000/health")
    print("🔗 WebSocket: ws://127.0.0.1:8000/ws/gas")
    print("=" * 50)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_config=None)

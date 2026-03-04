from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from routes.pantry import router as pantry_router
from routes.recipes import router as recipes_router
from routes.user import router as user_router
from services.supabase_service import verify_supabase_connection

app = FastAPI(title="Just Cook It Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_checks() -> None:
    ok, message = verify_supabase_connection()
    print(f"[startup] {message}")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": "just-cook-it-backend-fastapi",
    }


app.include_router(recipes_router)
app.include_router(pantry_router)
app.include_router(user_router)

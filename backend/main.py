from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from services.supabase_service import get_dietary_restrictions

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/dietary-restrictions")
def dietary_restrictions():
    return get_dietary_restrictions()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
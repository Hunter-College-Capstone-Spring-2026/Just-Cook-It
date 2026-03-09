from fastapi import FastAPI
from app.utils.config import settings
from fastapi.middleware.cors import CORSMiddleware
from app.routes import recipes, pantry, user
from app.services.supabase_service import get_dietary_restrictions

app = FastAPI()

# allow frontend to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# register route modules
app.include_router(recipes.router)
app.include_router(pantry.router)
app.include_router(user.router)


@app.get("/")
def root():
    return {"message": "Just Cook It API is running"}


# simple health check
@app.get("/api/health")
def health():
    return {"ok": True}


# DB test endpoint
@app.get("/api/dietary-restrictions")
def dietary_restrictions():
    return get_dietary_restrictions()


# remove later since we can run with `uvicorn app.main:app` in terminal, but this allows us to run with `python app/main.py` which is a bit more intuitive for development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
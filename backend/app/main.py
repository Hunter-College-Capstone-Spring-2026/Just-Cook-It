from fastapi import FastAPI
from app.routes import recipes, pantry, user

app = FastAPI()

app.include_router(recipes.router)
app.include_router(pantry.router)
app.include_router(user.router)

@app.get("/")
def root():
    return {"message": "Just Cook It API is running"}
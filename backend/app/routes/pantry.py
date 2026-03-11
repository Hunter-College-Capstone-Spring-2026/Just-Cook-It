from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.ingredient import PantryAddRequest
from app.services.supabase_service import add_user_pantry_ingredients, get_user_pantry

router = APIRouter(
    prefix="/pantry",
    tags=["pantry"]
)

@router.get("/")
def get_pantry(userId: str = Query(..., min_length=3)):
    return {"userId": userId, "ingredients": get_user_pantry(userId)}


@router.post("/add")
def add_to_pantry(payload: PantryAddRequest):
    if not payload.ingredients:
        raise HTTPException(status_code=400, detail="ingredients cannot be empty")
    ingredients = add_user_pantry_ingredients(payload.user_id, [item.name for item in payload.ingredients])
    return {"ok": True, "userId": payload.user_id, "ingredients": ingredients}


@router.get("/api/pantry")
def get_pantry_compat(userId: str = Query(..., min_length=3)):
    return get_pantry(userId=userId)


@router.post("/api/pantry/add")
def add_to_pantry_compat(payload: PantryAddRequest):
    return add_to_pantry(payload)

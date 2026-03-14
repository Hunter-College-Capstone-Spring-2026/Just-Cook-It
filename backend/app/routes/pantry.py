from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.ingredient import PantryAddRequest, PantryRemoveRequest
from app.services.supabase_service import (
    add_user_pantry_ingredients,
    get_user_pantry,
    remove_user_pantry_ingredient,
)

router = APIRouter(
    prefix="/api/pantry",
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


@router.delete("/remove")
def remove_from_pantry(payload: PantryRemoveRequest):
    if not payload.ingredient_name.strip():
        raise HTTPException(status_code=400, detail="ingredient_name cannot be empty")
    ingredients = remove_user_pantry_ingredient(payload.user_id, payload.ingredient_name)
    return {"ok": True, "userId": payload.user_id, "ingredients": ingredients}

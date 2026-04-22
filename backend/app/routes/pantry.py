from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.ingredient import PantryAddRequest, PantryRemoveRequest, CookRecipeRequest
from app.services.supabase_service import (
    add_user_pantry_ingredients,
    clear_user_pantry,
    get_user_pantry,
    remove_user_pantry_ingredient,
    save_user_cooked_recipe,
)

router = APIRouter(
    prefix="/api/pantry",
    tags=["pantry"]
)

#Backend entry point to get pantry content for the user
@router.get("/")
def get_pantry(userId: str = Query(..., min_length=3)):
    return {"userId": userId, "ingredients": get_user_pantry(userId)}


@router.delete("/")
def clear_pantry(userId: str = Query(..., min_length=3)):
    result = clear_user_pantry(userId)
    return {"ok": result.get("saved", False), **result}

#Backend entry point to add ingredients to the user's pantry
@router.post("/add")
def add_to_pantry(payload: PantryAddRequest):
    if not payload.ingredients:
        raise HTTPException(status_code=400, detail="ingredients cannot be empty")
    try:
        ingredients = add_user_pantry_ingredients(payload.user_id, [item.name for item in payload.ingredients])
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "userId": payload.user_id, "ingredients": ingredients}


@router.post("/cook")
def cook_recipe(payload: CookRecipeRequest):
    """
    Mark a recipe as cooked.
    - Adds the recipe's ingredients to the user's pantry.
    - Records the cooked event on the UserRecipe row (sets user_recipe_cooked_at).
    Both happen in one request so there is no partial state.
    """
    if not payload.ingredients:
        raise HTTPException(status_code=400, detail="ingredients cannot be empty")

    # 1. Add ingredients to pantry
    try:
        updated_pantry = add_user_pantry_ingredients(
            payload.user_id,
            [item.name for item in payload.ingredients],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # 2. Record cooked on UserRecipe (best-effort — never blocks the pantry update)
    cooked_warning: str | None = None
    if payload.recipe:
        result = save_user_cooked_recipe({
            "userId": payload.user_id,
            "recipe": payload.recipe.model_dump(),
        })
        cooked_warning = result.get("warning")

    return {
        "ok": True,
        "userId": payload.user_id,
        "ingredients": updated_pantry,
        "cookedWarning": cooked_warning,
    }


@router.delete("/remove")
def remove_from_pantry(payload: PantryRemoveRequest):
    if not payload.ingredient_name.strip():
        raise HTTPException(status_code=400, detail="ingredient_name cannot be empty")
    ingredients = remove_user_pantry_ingredient(payload.user_id, payload.ingredient_name)
    return {"ok": True, "userId": payload.user_id, "ingredients": ingredients}

from __future__ import annotations
import requests
from fastapi import HTTPException
from app.utils.config import settings
from app.services.supabase_service import (
    get_user_pantry,
    get_user_profile,
    get_user_settings,
)


def _normalize_recipe_summary(item: dict) -> dict:
    return {
        "recipeId": item.get("id"),
        "recipeName": item.get("title"),
        "recipeImageUrl": item.get("image"),
        "readyInMinutes": item.get("readyInMinutes"),
        "usedIngredientCount": item.get("usedIngredientCount", 0),
        "missedIngredientCount": item.get("missedIngredientCount", 0),
        "missedIngredients": [
            ing.get("name")
            for ing in item.get("missedIngredients", [])
            if ing.get("name")
        ],
        "usedIngredients": [
            ing.get("name")
            for ing in item.get("usedIngredients", [])
            if ing.get("name")
        ],
        "allIngredients": [
            ing.get("name")
            for ing in (
                (item.get("usedIngredients", []) or [])
                + (item.get("missedIngredients", []) or [])
            )
            if ing.get("name")
        ],
    }


def _first_valid_int(*values: object) -> int | None:
    for value in values:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            continue
        if parsed > 0:
            return parsed
    return None


def _normalize_flag_name(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


def _derive_diet_and_intolerances(dietary: dict) -> tuple[str | None, str | None]:
    selected = {
        _normalize_flag_name(key)
        for key, enabled in (dietary or {}).items()
        if enabled and isinstance(key, str) and key.strip()
    }

    diet_priority = [
        ("vegan", "vegan"),
        ("vegetarian", "vegetarian"),
        ("pescetarian", "pescetarian"),
        ("ketogenic", "ketogenic"),
        ("paleo", "paleo"),
        ("primal", "primal"),
        ("whole30", "whole30"),
        ("lowfodmap", "fodmap"),
    ]

    diet = next((mapped for key, mapped in diet_priority if key in selected), None)

    intolerance_map = {
        "glutenfree": "gluten",
        "dairyfree": "dairy",
        "eggfree": "egg",
        "grainfree": "grain",
        "peanutfree": "peanut",
        "shellfishfree": "shellfish",
        "soyfree": "soy",
        "sulfitefree": "sulfite",
        "treenutfree": "tree nut",
        "wheatfree": "wheat",
        "sesamefree": "sesame",
        "gluten": "gluten",
        "dairy": "dairy",
        "egg": "egg",
        "grain": "grain",
        "peanut": "peanut",
        "shellfish": "shellfish",
        "soy": "soy",
        "sulfite": "sulfite",
        "treenut": "tree nut",
        "wheat": "wheat",
        "sesame": "sesame",
    }

    mapped_intolerances = sorted(
        {intolerance_map[key] for key in selected if key in intolerance_map}
    )
    intolerances = ",".join(mapped_intolerances) if mapped_intolerances else None
    return diet, intolerances

def search_recipes_complex(
    user_id: str,
    ingredients: str | None = None,
    query_text: str | None = None,
    number: int = 3,
    ranking: int = 1,
    ignore_pantry: bool = True,
    max_ready_time: int | None = None
):
    url = f"{settings.spoonacular_base_url}/recipes/complexSearch"

    user_profile = get_user_profile(user_id)
    dietary = user_profile.get("dietary", {})

    normalized_ingredients = ",".join(
        [part.strip() for part in (ingredients or "").split(",") if part.strip()]
    )
    normalized_query = (query_text or "").strip()

    if not normalized_ingredients and not normalized_query:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one ingredient or a natural language query."
        )

    params = {
        "apiKey": settings.spoonacular_api_key,
        "number": number,
        "addRecipeInformation": True,
        "fillIngredients": True,
        "ignorePantry": str(ignore_pantry).lower(),
    }

    if normalized_ingredients:
        params["includeIngredients"] = normalized_ingredients

    if normalized_query:
        params["query"] = normalized_query

    if ranking == 1:
        params["sort"] = "max-used-ingredients"
    else:
        params["sort"] = "min-missing-ingredients"

    if max_ready_time is not None:
        params["maxReadyTime"] = max_ready_time

    if dietary.get("vegetarian"):
        params["diet"] = "vegetarian"
    elif dietary.get("vegan"):
        params["diet"] = "vegan"

    if dietary.get("glutenFree"):
        params["intolerances"] = "gluten"

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        raw_results = response.json().get("results", [])
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Spoonacular request failed: {exc}"
        ) from exc

    return {"results": [_normalize_recipe_summary(item) for item in raw_results]}

def search_recipes_by_ingredients(
    ingredients: str,
    number: int = 10,
    ranking: int = 1,
    ignore_pantry: bool = True,
    max_ready_time: int | None = None
):
    url = f"{settings.spoonacular_base_url}/recipes/findByIngredients"

    params = {
        "apiKey": settings.spoonacular_api_key,
        "ingredients": ingredients,
        "number": number,
        "ranking": ranking,
        "ignorePantry": str(ignore_pantry).lower(),
        "addRecipeInformation": True
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        raw_results = response.json()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Spoonacular request failed: {exc}")

    # time filtering
    if max_ready_time is not None:
        raw_results = [
            r for r in raw_results
            if r.get("readyInMinutes") and r["readyInMinutes"] <= max_ready_time
        ]

    return {"results": [_normalize_recipe_summary(item) for item in raw_results]}


def get_personalized_recipe_suggestion(
    user_id: str,
    max_ready_time: int | None = None,
    exclude_recipe_id: int | None = None,
    suggestion_index: int | None = None,
):
    url = f"{settings.spoonacular_base_url}/recipes/complexSearch"

    user_profile = get_user_profile(user_id)
    user_settings = get_user_settings(user_id)
    pantry_items = get_user_pantry(user_id)

    derived_max_ready_time = _first_valid_int(
        max_ready_time,
        user_profile.get("maxReadyTime"),
        user_profile.get("maxTime"),
        user_settings.get("maxReadyTime"),
        user_settings.get("maxTime"),
        user_settings.get("preferredMaxReadyTime"),
        user_settings.get("readyTime"),
    ) or 30

    dietary = user_profile.get("dietary", {})
    diet, intolerances = _derive_diet_and_intolerances(dietary)

    params = {
        "apiKey": settings.spoonacular_api_key,
        "number": 10,
        "addRecipeInformation": True,
        "fillIngredients": True,
        "sort": "min-missing-ingredients",
        "maxReadyTime": derived_max_ready_time,
        "ignorePantry": "true",
    }

    normalized_pantry = ",".join(
        [item.strip() for item in (pantry_items or []) if isinstance(item, str) and item.strip()]
    )
    if normalized_pantry:
        params["includeIngredients"] = normalized_pantry

    if diet:
        params["diet"] = diet
    if intolerances:
        params["intolerances"] = intolerances

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        raw_results = response.json().get("results", [])
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Spoonacular request failed: {exc}",
        ) from exc

    if not raw_results:
        return {"suggestion": None}

    selected = None

    if suggestion_index is None:
        for item in raw_results:
            if exclude_recipe_id is None or item.get("id") != exclude_recipe_id:
                selected = item
                break
    else:
        index = suggestion_index % len(raw_results)
        candidate = raw_results[index]
        if exclude_recipe_id is None or candidate.get("id") != exclude_recipe_id:
            selected = candidate
        else:
            for offset in range(1, len(raw_results)):
                rotated = raw_results[(index + offset) % len(raw_results)]
                if rotated.get("id") != exclude_recipe_id:
                    selected = rotated
                    break

    if selected is None:
        selected = raw_results[0]

    return {"suggestion": _normalize_recipe_summary(selected)}

def get_recipe_details_by_id(recipe_id: int):
    url = f"{settings.spoonacular_base_url}/recipes/{recipe_id}/information"

    params = {
        "apiKey": settings.spoonacular_api_key
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Spoonacular request failed: {exc}"
        )

    return {
        "id": data.get("id"),
        "title": data.get("title"),
        "image": data.get("image"),
        "readyInMinutes": data.get("readyInMinutes"),
        "extendedIngredients": data.get("extendedIngredients", []),
        "instructions": data.get("instructions"),
        "analyzedInstructions": data.get("analyzedInstructions", []),
        "cuisines": data.get("cuisines", []),
        "dishTypes": data.get("dishTypes", []),
    }

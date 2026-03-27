from __future__ import annotations

from typing import Any

from supabase import create_client

from app.utils.config import settings

supabase_anon = create_client(settings.supabase_url, settings.supabase_anon_key)
service_supabase = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key or settings.supabase_anon_key,
)


def get_supabase():
    return service_supabase


def get_service_supabase():
    return service_supabase


def get_anon_supabase():
    return supabase_anon


# Default helper used by existing code paths. Uses service role key when available.
supabase = service_supabase


def _safe_first(rows: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    if not rows:
        return None
    return rows[0]


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _get_state_blob(state_row: dict[str, Any] | None) -> dict[str, Any]:
    # Different schema iterations stored app state under different JSON columns; accept any known shape.
    if not state_row:
        return {}
    for key in ("state_json", "app_state", "state", "payload"):
        blob = state_row.get(key)
        if isinstance(blob, dict):
            return blob
    return {}


def _clean_string(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _clean_string_list(values: Any) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in _safe_list(values):
        item = _clean_string(value)
        key = item.lower()
        if not item or key in seen:
            continue
        seen.add(key)
        cleaned.append(item)
    return cleaned


def _normalize_cooked_recipe(recipe: Any) -> dict[str, Any] | None:
    if not isinstance(recipe, dict):
        return None

    recipe_id = recipe.get("recipeId", recipe.get("id"))
    title = _clean_string(recipe.get("title", recipe.get("recipeName", "")))
    if recipe_id in (None, "") or not title:
        return None

    try:
        recipe_id = int(recipe_id)
    except (TypeError, ValueError):
        return None

    ready_in_minutes = recipe.get("readyInMinutes")
    try:
        ready_in_minutes = int(ready_in_minutes) if ready_in_minutes is not None else None
    except (TypeError, ValueError):
        ready_in_minutes = None

    return {
        "recipeId": recipe_id,
        "title": title,
        "image": _clean_string(recipe.get("image", "")),
        "readyInMinutes": ready_in_minutes,
        "cuisines": _clean_string_list(recipe.get("cuisines", [])),
        "dishTypes": _clean_string_list(recipe.get("dishTypes", [])),
        "ingredients": _clean_string_list(recipe.get("ingredients", [])),
        "cookedAt": _clean_string(recipe.get("cookedAt", "")),
    }


def _extract_cooked_recipes(state_blob: dict[str, Any]) -> list[dict[str, Any]]:
    recipes = [
        normalized
        for recipe in _safe_list(state_blob.get("cookedRecipes", []))
        if (normalized := _normalize_cooked_recipe(recipe))
    ]
    recipes.sort(key=lambda recipe: recipe.get("cookedAt", ""), reverse=True)
    return recipes[:30]


def get_dietary_restrictions():
    response = supabase.table(settings.supabase_dietary_restriction_table).select("*").execute()
    return response.data or []


def _get_user_dietary_restrictions(user_id: str) -> dict[str, bool]:
    try:
        user_diet_rows = supabase.table(settings.supabase_user_dietary_table).select("restriction_id").eq("user_id", user_id).execute().data or []
        restriction_ids = [row.get("restriction_id") for row in user_diet_rows if row.get("restriction_id") is not None]
        if not restriction_ids:
            return {}

        restriction_rows = supabase.table(settings.supabase_dietary_restriction_table).select("dietary_restriction_name").in_("restriction_id", restriction_ids).execute().data or []
        return {row.get("dietary_restriction_name", ""): True for row in restriction_rows if row.get("dietary_restriction_name")}
    except Exception:
        return {}


def sign_up(email: str, password: str, name: str | None = None):
    response = supabase.auth.sign_up({
        "email": email,
        "password": password,
        "options": {
            "data": {"name": name or ""}
        }
    })
    return response

def sign_in(email: str, password: str):
    response = supabase.auth.sign_in_with_password({
        "email": email,
        "password": password
    })
    return response

def sign_out(jwt: str):
    # Pass the user's token so Supabase invalidates their session
    supabase.auth.sign_out()
    return {"message": "Signed out"}






def get_user_profile(user_id: str):
    # Profile data is split across the user table and the generic app-state blob, so we merge both sources here.
    profile: dict[str, Any] = {
        "userId": user_id,
        "name": "",
        "email": "",
        "dietary": {},
        "notes": "",
        "cookedRecipes": [],
    }

    try:
        user_row = _safe_first(
            supabase.table(settings.supabase_user_table).select("*").eq("user_id", user_id).limit(1).execute().data
        )
        if user_row:
            profile["name"] = user_row.get("user_name", user_row.get("name", profile["name"]))
            profile["email"] = user_row.get("user_email", user_row.get("email", profile["email"]))
    except Exception:
        pass

    # Attempt to read legacy app state first; if unavailable, use dedicated dietary join table.
    try:
        state_row = _safe_first(
            supabase.table(settings.supabase_state_table).select("*").eq("user_id", user_id).limit(1).execute().data
        )
        state_blob = _get_state_blob(state_row)
        state_profile = _safe_dict(state_blob.get("profile"))
        profile.update(
            {
                "dietary": _safe_dict(state_profile.get("dietary", profile.get("dietary", {}))),
                "notes": state_profile.get("notes", profile.get("notes", "")),
                "cookedRecipes": _extract_cooked_recipes(state_blob),
            }
        )
    except Exception:
        # ignore missing legacy state table
        pass

    if not profile.get("dietary"):
        profile["dietary"] = _get_user_dietary_restrictions(user_id)

    return profile


def _normalize_dietary_names(value: Any) -> set[str]:
    if isinstance(value, dict):
        return {k.strip() for k, v in value.items() if isinstance(k, str) and v and k.strip()}
    if isinstance(value, (list, tuple, set)):
        return {str(item).strip() for item in value if isinstance(item, str) and item.strip()}
    return set()


def _sync_user_dietary_restrictions(user_id: str, selected_names: set[str]):
    try:
        # Ensure restriction records exist for selected names
        existing = supabase.table(settings.supabase_dietary_restriction_table).select("restriction_id,dietary_restriction_name").in_("dietary_restriction_name", list(selected_names)).execute().data or []
        existing_map = {item["dietary_restriction_name"]: item["restriction_id"] for item in existing}

        to_create = [name for name in selected_names if name not in existing_map]
        if to_create:
            for name in to_create:
                r = supabase.table(settings.supabase_dietary_restriction_table).insert({"dietary_restriction_name": name}).execute().data
                if r and isinstance(r, list) and r[0].get("restriction_id"):
                    existing_map[name] = r[0]["restriction_id"]

        # Sync user restrictions by ID
        desired_ids = {existing_map[name] for name in selected_names if name in existing_map}
        current = supabase.table(settings.supabase_user_dietary_table).select("restriction_id").eq("user_id", user_id).execute().data or []
        current_ids = {item.get("restriction_id") for item in current if item.get("restriction_id") is not None}

        to_add = desired_ids - current_ids
        to_remove = current_ids - desired_ids

        if to_add:
            supabase.table(settings.supabase_user_dietary_table).insert(
                [{"user_id": user_id, "restriction_id": rid} for rid in to_add]
            ).execute()

        if to_remove:
            supabase.table(settings.supabase_user_dietary_table).delete().eq("user_id", user_id).in_("restriction_id", list(to_remove)).execute()

        return True
    except Exception:
        return False


def save_user_profile(payload: dict[str, Any]):
    user_id = payload.get("userId")
    if not user_id:
        return {"saved": False, "warning": "userId is required."}

    warning = None

    try:
        supabase.table(settings.supabase_user_table).upsert(
            {
                "user_id": user_id,
                "user_name": payload.get("name", ""),
                "user_email": payload.get("email", ""),
            },
            on_conflict="user_id",
        ).execute()
    except Exception as exc:
        warning = f"user table save skipped: {exc}"

    dietary_names = _normalize_dietary_names(payload.get("dietary", {}))
    if dietary_names:
        if not _sync_user_dietary_restrictions(user_id, dietary_names):
            warning = f"{warning}; user dietary sync failed" if warning else "user dietary sync failed"
    else:
        # If no dietary information provided, clear recorded values to avoid stale data.
        try:
            supabase.table(settings.supabase_user_dietary_table).delete().eq("user_id", user_id).execute()
        except Exception as exc:
            warning = f"{warning}; user dietary clear failed: {exc}" if warning else f"user dietary clear failed: {exc}"

    # Removed legacy state table save since dietary now uses dedicated join table.

    return {"saved": True, "warning": warning}


def get_user_settings(user_id: str):
    # Settings live inside the shared state blob, with defaults filling gaps for first-run users.
    defaults = {"quickRecipes": True, "notifications": True, "units": "metric"}
    try:
        state_row = _safe_first(
            supabase.table(settings.supabase_state_table).select("*").eq("user_id", user_id).limit(1).execute().data
        )
        state_blob = _get_state_blob(state_row)
        return {**defaults, **_safe_dict(state_blob.get("settings", {}))}
    except Exception:
        return defaults


def save_user_settings(payload: dict[str, Any]):
    user_id = payload.get("userId")
    if not user_id:
        return {"saved": False, "warning": "userId is required."}

    warning = None
    try:
        current_state = _safe_first(
            supabase.table(settings.supabase_state_table).select("*").eq("user_id", user_id).limit(1).execute().data
        )
        state_blob = _get_state_blob(current_state)
        state_blob["settings"] = {
            "quickRecipes": bool(payload.get("quickRecipes", True)),
            "notifications": bool(payload.get("notifications", True)),
            "units": payload.get("units", "metric"),
            "allowUsageAnalytics": bool(payload.get("allowUsageAnalytics", False)),
            "allowProgressNudges": bool(payload.get("allowProgressNudges", True)),
        }
        supabase.table(settings.supabase_state_table).upsert(
            {"user_id": user_id, "state_json": state_blob},
            on_conflict="user_id",
        ).execute()
    except Exception as exc:
        warning = f"settings save skipped: {exc}"

    return {"saved": True, "warning": warning}


def save_user_cooked_recipe(payload: dict[str, Any]):
    user_id = payload.get("userId")
    recipe = _normalize_cooked_recipe(payload.get("recipe"))
    if not user_id:
        return {"saved": False, "warning": "userId is required.", "recipes": []}
    if not recipe:
        return {"saved": False, "warning": "recipe is required.", "recipes": []}

    warning = None
    recipes: list[dict[str, Any]] = [recipe]

    try:
        current_state = _safe_first(
            supabase.table(settings.supabase_state_table).select("*").eq("user_id", user_id).limit(1).execute().data
        )
        state_blob = _get_state_blob(current_state)
        existing = _extract_cooked_recipes(state_blob)

        deduped: dict[tuple[int, str], dict[str, Any]] = {}
        for item in [recipe, *existing]:
            key = (item["recipeId"], item.get("cookedAt", ""))
            if key not in deduped:
                deduped[key] = item

        recipes = list(deduped.values())
        recipes.sort(key=lambda item: item.get("cookedAt", ""), reverse=True)
        recipes = recipes[:30]

        state_blob["cookedRecipes"] = recipes
        supabase.table(settings.supabase_state_table).upsert(
            {"user_id": user_id, "state_json": state_blob},
            on_conflict="user_id",
        ).execute()
    except Exception as exc:
        warning = f"cooked recipe save skipped: {exc}"

    return {"saved": True, "warning": warning, "recipes": recipes}


def clear_user_cooked_recipes(user_id: str):
    if not user_id:
        return {"saved": False, "warning": "userId is required.", "recipes": []}

    warning = None

    try:
        current_state = _safe_first(
            supabase.table(settings.supabase_state_table).select("*").eq("user_id", user_id).limit(1).execute().data
        )
        state_blob = _get_state_blob(current_state)
        state_blob["cookedRecipes"] = []
        supabase.table(settings.supabase_state_table).upsert(
            {"user_id": user_id, "state_json": state_blob},
            on_conflict="user_id",
        ).execute()
    except Exception as exc:
        warning = f"cooked recipe reset skipped: {exc}"

    return {"saved": True, "warning": warning, "recipes": []}

#Core data function to get the user's pantry items.
def get_user_pantry(user_id: str):
    # Pantry data may arrive either as denormalized names on the join table or via ingredient IDs from older rows.
    names: list[str] = []
    try:
        rows = (
            supabase.table(settings.supabase_user_ingredient_table)
            .select("ingredient_name,ingredient_id")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
        names.extend([row["ingredient_name"] for row in rows if row.get("ingredient_name")])

        ingredient_ids = [row.get("ingredient_id") for row in rows if row.get("ingredient_id") is not None]
        if ingredient_ids:
            ingredient_rows = (
                supabase.table(settings.supabase_ingredient_table)
                .select("ingredient_id,ingredient_name")
                .in_("ingredient_id", ingredient_ids)
                .execute()
                .data
                or []
            )
            names.extend([row["ingredient_name"] for row in ingredient_rows if row.get("ingredient_name")])
    except Exception:
        return []

    seen: set[str] = set()
    unique_names: list[str] = []
    for name in names:
        key = name.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique_names.append(name.strip())
    return unique_names

#Core data function to add pantry items for the user.
def add_user_pantry_ingredients(user_id: str, ingredients: list[str]):
    # Write pantry items idempotently so retries and offline queue replays do not duplicate entries.
    normalized = [item.strip() for item in ingredients if item and item.strip()]
    if not normalized:
        return []

    for name in normalized:
        try:
            existing = (
                supabase.table(settings.supabase_user_ingredient_table)
                .select("user_id")
                .eq("user_id", user_id)
                .eq("ingredient_name", name)
                .limit(1)
                .execute()
                .data
            )
            if existing:
                continue
            supabase.table(settings.supabase_user_ingredient_table).insert(
                {"user_id": user_id, "ingredient_name": name}
            ).execute()
        except Exception:
            continue

    return get_user_pantry(user_id)

#Core data function to remove a pantry item for the user. 
def remove_user_pantry_ingredient(user_id: str, ingredient_name: str):
    normalized = ingredient_name.strip()
    if not normalized:
        return get_user_pantry(user_id)

    try:
        rows = (
            supabase.table(settings.supabase_user_ingredient_table)
            .select("ingredient_name")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
        matching_names = [
            row_name
            for row in rows
            if (row_name := row.get("ingredient_name"))
            and row_name.strip().lower() == normalized.lower()
        ]
        for row_name in matching_names:
            (
                supabase.table(settings.supabase_user_ingredient_table)
                .delete()
                .eq("user_id", user_id)
                .eq("ingredient_name", row_name)
                .execute()
            )
    except Exception:
        pass

    return get_user_pantry(user_id)


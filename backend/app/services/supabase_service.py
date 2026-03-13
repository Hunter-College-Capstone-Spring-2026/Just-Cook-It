from __future__ import annotations

from typing import Any

from supabase import create_client

from app.utils.config import settings

supabase = create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase():
    return supabase


def _safe_first(rows: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    if not rows:
        return None
    return rows[0]


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _get_state_blob(state_row: dict[str, Any] | None) -> dict[str, Any]:
    # Different schema iterations stored app state under different JSON columns; accept any known shape.
    if not state_row:
        return {}
    for key in ("state_json", "app_state", "state", "payload"):
        blob = state_row.get(key)
        if isinstance(blob, dict):
            return blob
    return {}


def get_dietary_restrictions():
    response = supabase.table("DietaryRestriction").select("*").execute()
    return response.data or []


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
    profile: dict[str, Any] = {"userId": user_id, "name": "", "email": "", "dietary": {}, "notes": ""}

    try:
        user_row = _safe_first(
            supabase.table(settings.supabase_user_table).select("*").eq("user_id", user_id).limit(1).execute().data
        )
        if user_row:
            profile["name"] = user_row.get("user_name", user_row.get("name", profile["name"]))
            profile["email"] = user_row.get("user_email", user_row.get("email", profile["email"]))
    except Exception:
        pass

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
            }
        )
    except Exception:
        pass

    return profile


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

    try:
        current_state = _safe_first(
            supabase.table(settings.supabase_state_table).select("*").eq("user_id", user_id).limit(1).execute().data
        )
        state_blob = _get_state_blob(current_state)
        state_blob["profile"] = {
            "dietary": _safe_dict(payload.get("dietary", {})),
            "notes": payload.get("notes", ""),
        }

        supabase.table(settings.supabase_state_table).upsert(
            {"user_id": user_id, "state_json": state_blob},
            on_conflict="user_id",
        ).execute()
    except Exception as exc:
        warning = f"{warning}; state table save skipped: {exc}" if warning else f"state table save skipped: {exc}"

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

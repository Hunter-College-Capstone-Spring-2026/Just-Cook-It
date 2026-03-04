from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Tuple

import requests
from fastapi import HTTPException

from app.config import settings


def _ensure_supabase_config() -> None:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=500, detail="Missing SUPABASE_URL or SUPABASE_ANON_KEY")


def _supabase_headers(prefer: str | None = None) -> Dict[str, str]:
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _request_table(
    method: str,
    table: str,
    *,
    params: Dict[str, Any] | None = None,
    json_body: Any = None,
    prefer: str | None = None,
) -> Any:
    _ensure_supabase_config()
    url = f"{settings.supabase_url}/rest/v1/{table}"

    try:
        resp = requests.request(
            method=method,
            url=url,
            headers=_supabase_headers(prefer=prefer),
            params=params,
            json=json_body,
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Supabase request failed: {exc}") from exc

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Supabase table '{table}' failed ({resp.status_code}): {resp.text[:220]}",
        )

    if not resp.text:
        return None

    content_type = resp.headers.get("content-type", "")
    if "application/json" in content_type:
        return resp.json()
    return resp.text


def verify_supabase_connection() -> Tuple[bool, str]:
    try:
        _request_table("GET", settings.supabase_user_table, params={"select": "user_id", "limit": 1})
        return True, "Supabase connection check passed (table access confirmed)."
    except HTTPException as exc:
        return False, str(exc.detail)


def _default_profile(user_id: str) -> Dict[str, Any]:
    return {
        "userId": user_id,
        "email": "",
        "name": "",
        "notes": "",
        "dietary": {
            "vegetarian": False,
            "vegan": False,
            "halal": False,
            "glutenFree": False,
        },
        "weeklyTime": {
            "Monday": "",
            "Tuesday": "",
            "Wednesday": "",
            "Thursday": "",
            "Friday": "",
            "Saturday": "",
            "Sunday": "",
        },
    }


def _default_settings(user_id: str) -> Dict[str, Any]:
    return {
        "userId": user_id,
        "notifications": True,
        "quickRecipes": True,
        "units": "metric",
    }


def _get_state_row(user_id: str) -> Dict[str, Any] | None:
    try:
        data = _request_table(
            "GET",
            settings.supabase_state_table,
            params={"select": "user_id,profile_json,settings_json", "user_id": f"eq.{user_id}", "limit": 1},
        )
        if isinstance(data, list) and data:
            return data[0]
        return None
    except HTTPException:
        # State table is optional for now.
        return None


def get_user_profile(user_id: str) -> Dict[str, Any]:
    user_rows = _request_table(
        "GET",
        settings.supabase_user_table,
        params={"select": "user_id,user_email,user_name", "user_id": f"eq.{user_id}", "limit": 1},
    )

    profile = _default_profile(user_id)

    if isinstance(user_rows, list) and user_rows:
        profile["email"] = user_rows[0].get("user_email", "")
        profile["name"] = user_rows[0].get("user_name", "")

    state_row = _get_state_row(user_id)
    if state_row and isinstance(state_row.get("profile_json"), dict):
        profile.update(state_row["profile_json"])

    return profile


def save_user_profile(profile_payload: Dict[str, Any]) -> Dict[str, Any]:
    user_id = profile_payload["userId"]
    email = profile_payload.get("email", "")
    name = profile_payload.get("name") or (email.split("@")[0] if "@" in email else "CookItUser")

    user_patch = {"user_email": email, "user_name": name}

    updated = _request_table(
        "PATCH",
        settings.supabase_user_table,
        params={"user_id": f"eq.{user_id}"},
        json_body=user_patch,
        prefer="return=representation",
    )

    if not updated:
        insert_payload = {
            "user_id": user_id,
            "user_email": email,
            "user_name": name,
            "user_password_hash": "managed-by-client-profile",
        }
        _request_table("POST", settings.supabase_user_table, json_body=insert_payload)

    state_payload = {
        "user_id": user_id,
        "profile_json": profile_payload,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    sync_warning = None
    try:
        _request_table(
            "POST",
            settings.supabase_state_table,
            json_body=state_payload,
            prefer="resolution=merge-duplicates,return=representation",
        )
    except HTTPException as exc:
        sync_warning = str(exc.detail)

    return {"saved": True, "warning": sync_warning}


def get_user_settings(user_id: str) -> Dict[str, Any]:
    settings_payload = _default_settings(user_id)

    state_row = _get_state_row(user_id)
    if state_row and isinstance(state_row.get("settings_json"), dict):
        settings_payload.update(state_row["settings_json"])

    return settings_payload


def save_user_settings(settings_payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "user_id": settings_payload["userId"],
        "settings_json": settings_payload,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        _request_table(
            "POST",
            settings.supabase_state_table,
            json_body=payload,
            prefer="resolution=merge-duplicates,return=representation",
        )
        return {"saved": True, "warning": None}
    except HTTPException as exc:
        return {"saved": False, "warning": str(exc.detail)}

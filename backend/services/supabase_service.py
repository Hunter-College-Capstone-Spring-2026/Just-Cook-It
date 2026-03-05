from __future__ import annotations
import requests
from fastapi import HTTPException
from app.config import settings

def _headers():
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
    }

def _get(table, params=None):
    resp = requests.get(
        f"{settings.supabase_url}/rest/v1/{table}",
        headers=_headers(),
        params=params,
        timeout=10,
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"{table} {resp.status_code}: {resp.text[:200]}")
    return resp.json()

def get_dietary_restrictions():
    return _get("DietaryRestriction", {"select": "restriction_id,dietary_restriction_name"})

def get_users():
    return _get("User", {"select": "user_id,user_email,user_name"})
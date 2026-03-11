from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query

from app.services.supabase_service import (
    get_user_profile,
    get_user_settings,
    save_user_profile,
    save_user_settings,
)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/profile")
def fetch_profile(userId: str = Query(..., min_length=3)):
    return get_user_profile(userId)


@router.put("/profile")
def update_profile(payload: dict[str, Any] = Body(...)):
    user_id = payload.get("userId")
    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required in profile payload")

    result = save_user_profile(payload)
    return {"ok": True, **result}


@router.get("/settings")
def fetch_settings(userId: str = Query(..., min_length=3)):
    return get_user_settings(userId)


@router.put("/settings")
def update_settings(payload: dict[str, Any] = Body(...)):
    user_id = payload.get("userId")
    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required in settings payload")

    result = save_user_settings(payload)
    return {"ok": result.get("saved", False), **result}

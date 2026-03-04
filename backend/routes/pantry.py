from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/pantry", tags=["pantry"])


@router.get("/")
def get_pantry_placeholder():
    return {
        "message": "Pantry endpoints are scaffolded for upcoming implementation.",
        "items": [],
    }

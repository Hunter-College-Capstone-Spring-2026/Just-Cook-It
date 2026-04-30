from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException

from app.models.auth import SignInRequest, SignUpRequest, SignOutRequest
from app.services.supabase_service import sign_in, sign_out, sign_up

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup")
def signup(payload: SignUpRequest):
    try:
        response = sign_up(payload.email, payload.password, payload.name)
        user = response.user
        session = response.session
        if not user:
            raise HTTPException(status_code=400, detail="Signup failed")
        return {
            "ok": True,
            "userId": str(user.id),
            "email": user.email,
            "accessToken": session.access_token if session else None,
            "refreshToken": session.refresh_token if session else None,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/signin")
def signin(payload: SignInRequest):
    try:
        response = sign_in(payload.email, payload.password)
        user = response.user
        session = response.session
        if not user or not session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {
            "ok": True,
            "userId": str(user.id),
            "email": user.email,
            "accessToken": session.access_token,
            "refreshToken": session.refresh_token,
        }
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.post("/signout")
def signout(payload: SignOutRequest = Body(default=SignOutRequest())):
    try:
        result = sign_out(user_id=payload.userId)
        return {"ok": True, **result}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
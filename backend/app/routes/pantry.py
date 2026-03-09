from fastapi import APIRouter

router = APIRouter(
    prefix="/pantry",
    tags=["pantry"]
)

@router.get("/")
def get_pantry():
    return {"message": "Pantry route works"}
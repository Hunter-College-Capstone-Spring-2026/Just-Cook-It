from pydantic import BaseModel, EmailStr

class SignUpRequest(BaseModel):
    email: str
    password: str
    name: str | None = None

class SignInRequest(BaseModel):
    email: str
    password: str
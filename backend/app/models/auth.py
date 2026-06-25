from pydantic import BaseModel, EmailStr, Field


class RequestAccessRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    organization: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    organization: str
    role: str
    status: str
    created_at: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AdminUserResponse(BaseModel):
    id: str
    name: str
    email: str
    organization: str
    requested_at: str
    approved_at: str | None = None

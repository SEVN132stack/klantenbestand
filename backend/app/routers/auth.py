from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime
from pydantic import BaseModel
from ..database import get_db
from ..models import User
from ..auth import verify_password, create_access_token, get_current_user

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

@router.post("/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username, User.actief == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Onjuiste inloggegevens")
    await db.execute(update(User).where(User.id == user.id).values(laatst_ingelogd=datetime.utcnow()))
    await db.commit()
    token = create_access_token({"sub": str(user.id), "role": user.role, "naam": user.naam})
    return {"access_token": token, "token_type": "bearer", "user": {"id": str(user.id), "naam": user.naam, "email": user.email, "role": user.role}}

@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"id": str(user.id), "naam": user.naam, "email": user.email, "role": user.role}

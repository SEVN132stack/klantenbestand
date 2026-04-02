import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from ..database import get_db
from ..models import User
from ..auth import hash_password, admin_only

router = APIRouter()

class UserIn(BaseModel):
    naam: str
    email: EmailStr
    password: Optional[str] = None
    role: str = "alleen_lezen"
    actief: bool = True

@router.get("/", dependencies=[admin_only])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.naam))
    return [_s(u) for u in result.scalars().all()]

@router.post("/", status_code=201, dependencies=[admin_only])
async def create_user(body: UserIn, db: AsyncSession = Depends(get_db)):
    if not body.password:
        raise HTTPException(400, "Wachtwoord is verplicht")
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "E-mailadres al in gebruik")
    u = User(naam=body.naam, email=body.email, password_hash=hash_password(body.password), role=body.role, actief=body.actief)
    db.add(u)
    await db.commit()
    return _s(u)

@router.put("/{uid}", dependencies=[admin_only])
async def update_user(uid: uuid.UUID, body: UserIn, db: AsyncSession = Depends(get_db)):
    u = await db.get(User, uid)
    if not u: raise HTTPException(404, "Niet gevonden")
    u.naam = body.naam
    u.email = body.email
    u.role = body.role
    u.actief = body.actief
    if body.password:
        u.password_hash = hash_password(body.password)
    await db.commit()
    return _s(u)

@router.delete("/{uid}", status_code=204, dependencies=[admin_only])
async def delete_user(uid: uuid.UUID, db: AsyncSession = Depends(get_db)):
    u = await db.get(User, uid)
    if not u: raise HTTPException(404, "Niet gevonden")
    await db.delete(u)
    await db.commit()

def _s(u: User):
    return {"id": str(u.id), "naam": u.naam, "email": u.email, "role": u.role, "actief": u.actief,
            "aangemaakt": u.aangemaakt.isoformat() if u.aangemaakt else None,
            "laatst_ingelogd": u.laatst_ingelogd.isoformat() if u.laatst_ingelogd else None}

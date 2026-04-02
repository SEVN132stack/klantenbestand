import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import date
from typing import Optional
from ..database import get_db
from ..models import Beschikking, AuditLog, AuditType, User
from ..auth import get_current_user, can_read, can_write

router = APIRouter()

class BeschikkingIn(BaseModel):
    datum_start: Optional[date] = None
    datum_einde: Optional[date] = None
    bedrag_beschikt: Optional[float] = None
    gefactureerd: Optional[float] = None
    betaald: Optional[float] = None
    facturatie_type: Optional[str] = None
    vast_bedrag: Optional[float] = None
    uren: Optional[int] = None
    minuten: Optional[int] = None
    prijs_per_uur: Optional[float] = None
    prijs_per_minuut: Optional[float] = None

async def _log(db, client_id, client_naam, user, actie):
    db.add(AuditLog(
        client_id=client_id, client_naam=client_naam,
        user_id=user.id, user_naam=user.naam,
        type=AuditType.edit, actie=actie,
    ))

@router.get("/{client_id}/beschikkingen")
async def get_beschikkingen(client_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=can_read):
    result = await db.execute(
        select(Beschikking)
        .where(Beschikking.client_id == client_id)
        .order_by(Beschikking.volgnummer)
    )
    return [_s(b) for b in result.scalars().all()]

@router.post("/{client_id}/beschikkingen", status_code=201)
async def add_beschikking(
    client_id: uuid.UUID,
    body: BeschikkingIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _=can_write
):
    result = await db.execute(
        select(Beschikking).where(Beschikking.client_id == client_id).order_by(Beschikking.volgnummer.desc())
    )
    existing = result.scalars().all()
    volgnummer = (existing[0].volgnummer + 1) if existing else 1

    b = Beschikking(client_id=client_id, volgnummer=volgnummer, **body.model_dump())
    db.add(b)
    await db.flush()
    await _log(db, client_id, None, user, f"Beschikking {volgnummer} toegevoegd")
    await db.commit()
    return _s(b)

@router.put("/{client_id}/beschikkingen/{b_id}")
async def update_beschikking(
    client_id: uuid.UUID,
    b_id: uuid.UUID,
    body: BeschikkingIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _=can_write
):
    b = await db.get(Beschikking, b_id)
    if not b or b.client_id != client_id:
        raise HTTPException(404, "Niet gevonden")
    for field, val in body.model_dump().items():
        setattr(b, field, val)
    await _log(db, client_id, None, user, f"Beschikking {b.volgnummer} bijgewerkt")
    await db.commit()
    return _s(b)

@router.delete("/{client_id}/beschikkingen/{b_id}", status_code=204)
async def delete_beschikking(
    client_id: uuid.UUID,
    b_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _=can_write
):
    b = await db.get(Beschikking, b_id)
    if not b or b.client_id != client_id:
        raise HTTPException(404, "Niet gevonden")
    await _log(db, client_id, None, user, f"Beschikking {b.volgnummer} verwijderd")
    await db.delete(b)
    await db.commit()

def _s(b: Beschikking) -> dict:
    return {
        "id": str(b.id),
        "client_id": str(b.client_id),
        "volgnummer": b.volgnummer,
        "datum_start": b.datum_start.isoformat() if b.datum_start else None,
        "datum_einde": b.datum_einde.isoformat() if b.datum_einde else None,
        "bedrag_beschikt": float(b.bedrag_beschikt) if b.bedrag_beschikt else None,
        "gefactureerd": float(b.gefactureerd) if b.gefactureerd else None,
        "betaald": float(b.betaald) if b.betaald else None,
        "facturatie_type": b.facturatie_type,
        "vast_bedrag": float(b.vast_bedrag) if b.vast_bedrag else None,
        "uren": b.uren,
        "minuten": b.minuten,
        "prijs_per_uur": float(b.prijs_per_uur) if b.prijs_per_uur else None,
        "prijs_per_minuut": float(b.prijs_per_minuut) if b.prijs_per_minuut else None,
        "aangemaakt": b.aangemaakt.isoformat() if b.aangemaakt else None,
    }

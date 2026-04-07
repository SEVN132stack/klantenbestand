import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import date
from typing import Optional
from ..database import get_db
from ..models import Client, AuditLog, User
from ..auth import get_current_user, can_read, can_write

router = APIRouter()

class ClientIn(BaseModel):
    naam: str
    bsn: Optional[str] = None
    geboortedatum: Optional[date] = None
    status: str = "Aangemeld"
    klant: Optional[str] = None
    locatie: Optional[str] = None
    begeleider_1: Optional[str] = None
    begeleider_2: Optional[str] = None
    datum_start: Optional[date] = None
    einde_beschikking: Optional[date] = None
    datum_sluiting: Optional[date] = None
    uur_per_week: Optional[str] = None
    enquete_gestuurd: Optional[str] = None
    laatste_gefactureerd: Optional[str] = None
    opmerkingen: Optional[str] = None

class NotitiePatch(BaseModel):
    notitie: str

async def _log(db, client_id, client_naam, user, atype, actie, veld=None, oud=None, nieuw=None):
    db.add(AuditLog(
        client_id=client_id, client_naam=client_naam,
        user_id=user.id, user_naam=user.naam,
        type=atype, actie=actie, veld=veld, oude_waarde=oud, nieuwe_waarde=nieuw,
    ))

@router.get("/")
async def list_clienten(db: AsyncSession = Depends(get_db), _=can_read):
    result = await db.execute(select(Client).order_by(Client.naam))
    return [_serialize(c) for c in result.scalars().all()]

@router.get("/{cid}")
async def get_client(cid: uuid.UUID, db: AsyncSession = Depends(get_db), _=can_read):
    c = await db.get(Client, cid)
    if not c: raise HTTPException(404, "Niet gevonden")
    return _serialize(c)

@router.post("/", status_code=201)
async def create_client(body: ClientIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), _=can_write):
    c = Client(**body.model_dump())
    db.add(c)
    await db.flush()
    await _log(db, c.id, c.naam, user, "add", "Cliënt toegevoegd aan het systeem")
    await db.commit()
    return _serialize(c)

@router.put("/{cid}")
async def update_client(cid: uuid.UUID, body: ClientIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), _=can_write):
    c = await db.get(Client, cid)
    if not c: raise HTTPException(404, "Niet gevonden")
    data = body.model_dump()
    FIELD_LABELS = {"naam":"Naam","bsn":"BSN","status":"Status","klant":"Organisatie","locatie":"Locatie","begeleider_1":"Begeleider 1","begeleider_2":"Begeleider 2","datum_start":"Datum start","einde_beschikking":"Einde beschikking","uur_per_week":"Uur per week","enquete_gestuurd":"Enquete gestuurd","laatste_gefactureerd":"Laatst gefactureerd"}
    for field, new_val in data.items():
        old_val = getattr(c, field)
        if str(old_val or "") != str(new_val or ""):
            atype = "status" if field == "status" else "edit"
            await _log(db, c.id, c.naam, user, atype,
                       "Status gewijzigd" if field == "status" else "Veld aangepast",
                       field, str(old_val or "—"), str(new_val or "—"))
            setattr(c, field, new_val)
    await db.commit()
    return _serialize(c)

@router.patch("/{cid}/notitie")
async def update_notitie(cid: uuid.UUID, body: NotitiePatch, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), _=can_write):
    c = await db.get(Client, cid)
    if not c: raise HTTPException(404, "Niet gevonden")
    await _log(db, c.id, c.naam, user, "note", "Notitie bijgewerkt", None, None, "(notitie opgeslagen)")
    c.notitie = body.notitie
    await db.commit()
    return {"ok": True}

@router.delete("/{cid}", status_code=204)
async def delete_client(cid: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), _=can_write):
    c = await db.get(Client, cid)
    if not c: raise HTTPException(404, "Niet gevonden")
    await _log(db, None, c.naam, user, "delete", "Cliënt verwijderd uit het systeem")
    await db.delete(c)
    await db.commit()

@router.get("/{cid}/audit")
async def get_audit(cid: uuid.UUID, db: AsyncSession = Depends(get_db), _=can_read):
    result = await db.execute(select(AuditLog).where(AuditLog.client_id == cid).order_by(AuditLog.tijdstip.desc()))
    return [_audit_serialize(a) for a in result.scalars().all()]

def _serialize(c: Client) -> dict:
    return {k: (str(v) if isinstance(v, uuid.UUID) else (v.isoformat() if hasattr(v, 'isoformat') else v))
            for k, v in c.__dict__.items() if not k.startswith("_")}

def _audit_serialize(a: AuditLog) -> dict:
    return {k: (str(v) if isinstance(v, uuid.UUID) else (v.isoformat() if hasattr(v, 'isoformat') else v))
            for k, v in a.__dict__.items() if not k.startswith("_")}

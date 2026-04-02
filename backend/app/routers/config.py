from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from ..database import get_db
from ..models import ConfigItem, AuditLog
from ..auth import can_read, admin_only

router = APIRouter()

class ConfigIn(BaseModel):
    categorie: str
    waarde: str
    volgorde: int = 0

@router.get("/", dependencies=[can_read])
async def get_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ConfigItem).order_by(ConfigItem.categorie, ConfigItem.volgorde))
    items = result.scalars().all()
    grouped: dict = {}
    for item in items:
        grouped.setdefault(item.categorie, []).append(item.waarde)
    return grouped

@router.post("/", status_code=201, dependencies=[admin_only])
async def add_config(body: ConfigIn, db: AsyncSession = Depends(get_db)):
    item = ConfigItem(categorie=body.categorie, waarde=body.waarde, volgorde=body.volgorde)
    db.add(item)
    await db.commit()
    return {"id": item.id, "categorie": item.categorie, "waarde": item.waarde}

@router.delete("/{item_id}", status_code=204, dependencies=[admin_only])
async def delete_config(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(ConfigItem, item_id)
    if not item: raise HTTPException(404, "Niet gevonden")
    await db.delete(item)
    await db.commit()

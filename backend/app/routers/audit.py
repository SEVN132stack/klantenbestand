import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from ..database import get_db
from ..models import AuditLog
from ..auth import can_read

router = APIRouter()

@router.get("/", dependencies=[can_read])
async def global_audit(
    type: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).order_by(AuditLog.tijdstip.desc()).limit(limit)
    if type:
        q = q.where(AuditLog.type == type)
    result = await db.execute(q)
    return [_s(a) for a in result.scalars().all()]

def _s(a: AuditLog):
    return {k: (str(v) if isinstance(v, uuid.UUID) else (v.isoformat() if hasattr(v, 'isoformat') else v))
            for k, v in a.__dict__.items() if not k.startswith("_")}

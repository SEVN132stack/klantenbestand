import io
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
import openpyxl
from ..database import get_db, AsyncSessionLocal
from ..models import User, UserRole
from ..auth import get_current_user

router = APIRouter()

KOLOMKOPPELING = {
    "BSN": "bsn",
    "Client naam": "naam",
    "Naam": "naam",
    "Geboortedatum": "geboortedatum",
    "Status Client": "status",
    "Status": "status",
    "Klant": "klant",
    "Organisatie": "klant",
    "Locatie": "locatie",
    "Begeleider 1": "begeleider_1",
    "Begeleider 2": "begeleider_2",
    "Einde beschikking": "einde_beschikking",
    "Einde sluiting": "datum_sluiting",
    "Datum sluiting": "datum_sluiting",
    "Datum start": "datum_start",
    "Eerste beschikking": "datum_start",
    "Bedrag beschikt": "bedrag_beschikt",
    "Gefactureerd": "gefactureerd",
    "Betaald": "betaald",
    "Opmerkingen": "opmerkingen",
    "Uur/dagdeel per week": "uur_per_week",
    "Tijd": "uur_per_week",
    "Laatst Gefactureerd": "laatste_gefactureerd",
    "Enquete gestuurd": "enquete_gestuurd",
    "Evaluatieformulier aanwezig?": "enquete_gestuurd",
}

DATUMVELDEN = {"geboortedatum", "datum_start", "einde_beschikking", "datum_sluiting"}
FLOATVELDEN = {"bedrag_beschikt", "gefactureerd", "betaald"}

def parse_datum(v):
    if v is None:
        return None
    if isinstance(v, float) and v != v:
        return None
    if isinstance(v, datetime):
        return v.date()
    s = str(v).strip()[:10]
    if not s or s.lower() in ("nan", "none", "-", ""):
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            pass
    return None

def parse_float(v):
    if v is None:
        return None
    if isinstance(v, float) and v != v:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", ".").strip())
    except Exception:
        return None

def parse_str(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if s.lower() in ("nan", "none", "") else s

@router.post("/import")
async def import_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.admin:
        return JSONResponse(status_code=403, content={"detail": "Alleen admins mogen importeren"})

    if not file.filename.lower().endswith((".xlsx", ".xls")):
        return JSONResponse(status_code=400, content={"detail": "Alleen .xlsx of .xls bestanden zijn toegestaan"})

    try:
        inhoud = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(inhoud), data_only=True)
    except Exception as e:
        return JSONResponse(status_code=400, content={"detail": "Ongeldig bestand: " + str(e)})

    blad = None
    for naam in ["Client informatie", "Clienten", "Sheet1"]:
        if naam in wb.sheetnames:
            blad = wb[naam]
            break
    if blad is None:
        blad = wb.active

    rijen = list(blad.iter_rows(values_only=True))
    if not rijen:
        return JSONResponse(status_code=400, content={"detail": "Bestand is leeg"})

    # Detecteer headerrij
    header_idx = 0
    for i, rij in enumerate(rijen[:5]):
        if len([c for c in rij if c is not None and str(c).strip()]) >= 3:
            header_idx = i
            break

    headers = [str(c).strip() if c is not None else "" for c in rijen[header_idx]]

    kolom_map = {}
    for i, h in enumerate(headers):
        if h in KOLOMKOPPELING and KOLOMKOPPELING[h] not in kolom_map:
            kolom_map[KOLOMKOPPELING[h]] = i

    if "naam" not in kolom_map:
        return JSONResponse(status_code=400, content={
            "detail": "Kolom 'Client naam' niet gevonden. Beschikbare kolommen: " + ", ".join(h for h in headers if h)
        })

    # Haal beschikbare DB kolommen op
    try:
        res = await db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='clienten'"
        ))
        db_cols = {r[0] for r in res.fetchall()}
    except Exception:
        db_cols = set(KOLOMKOPPELING.values()) | {"naam"}

    toegevoegd = 0
    overgeslagen = 0
    fouten = []

    for rij_nr, rij in enumerate(rijen[header_idx + 1:], start=header_idx + 2):
        if all(c is None or str(c).strip() in ("", "nan") for c in rij):
            continue

        data = {}
        for veld, idx in kolom_map.items():
            if idx >= len(rij) or veld not in db_cols:
                continue
            w = rij[idx]
            if veld in DATUMVELDEN:
                data[veld] = parse_datum(w)
            elif veld in FLOATVELDEN:
                data[veld] = parse_float(w)
            else:
                data[veld] = parse_str(w)

        naam = data.get("naam")
        if not naam:
            overgeslagen += 1
            continue

        # Gebruik een aparte sessie per rij zodat een fout de rest niet blokkeert
        try:
            async with AsyncSessionLocal() as row_session:
                async with row_session.begin():
                    velden = {k: v for k, v in data.items() if k in db_cols}
                    velden.setdefault("status", "Aangemeld")

                    kolommen = ", ".join(velden.keys())
                    params = ", ".join(":" + k for k in velden.keys())
                    await row_session.execute(
                        text("INSERT INTO clienten ({}) VALUES ({})".format(kolommen, params)),
                        velden
                    )

                    # Haal het nieuwe id op voor de auditlog
                    result = await row_session.execute(
                        text("SELECT id FROM clienten WHERE naam=:naam ORDER BY aangemaakt DESC LIMIT 1"),
                        {"naam": naam}
                    )
                    new_id = result.scalar()
                    if new_id:
                        await row_session.execute(
                            text("""INSERT INTO audit_log (client_id, client_naam, user_id, user_naam, type, actie)
                                    VALUES (:cid, :cnaam, :uid, :unaam, 'add', 'Client geimporteerd via Excel')"""),
                            {"cid": new_id, "cnaam": naam, "uid": str(user.id), "unaam": user.naam}
                        )
            toegevoegd += 1
        except Exception as e:
            fouten.append("Rij {}: {}".format(rij_nr, str(e)[:120]))
            overgeslagen += 1

    return JSONResponse(content={
        "toegevoegd": toegevoegd,
        "overgeslagen": overgeslagen,
        "fouten": fouten[:10],
        "bericht": "{} clienten geimporteerd, {} overgeslagen".format(toegevoegd, overgeslagen),
    })

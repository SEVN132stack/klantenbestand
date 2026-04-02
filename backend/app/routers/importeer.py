import io
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import openpyxl
from ..database import get_db
from ..models import Client, AuditLog, AuditType
from ..auth import get_current_user, admin_only
from ..models import User

router = APIRouter()

KOLOMKOPPELING = {
    "BSN":                    "bsn",
    "Client naam":            "naam",
    "Naam":                   "naam",
    "Geboortedatum":          "geboortedatum",
    "Status Client":          "status",
    "Status":                 "status",
    "Klant":                  "klant",
    "Organisatie":            "klant",
    "Locatie":                "locatie",
    "Begeleider 1":           "begeleider_1",
    "Begeleider 2":           "begeleider_2",
    "Einde beschikking":      "einde_beschikking",
    "Einde sluiting":         "datum_sluiting",
    "Datum sluiting":         "datum_sluiting",
    "Datum start":            "datum_start",
    "Eerste beschikking":     "datum_start",
    "Bedrag beschikt":        "bedrag_beschikt",
    "Gefactureerd":           "gefactureerd",
    "Betaald":                "betaald",
    "Opmerkingen":            "opmerkingen",
    "Uur/dagdeel per week":   "uur_per_week",
    "Tijd":                   "uur_per_week",
    "Laatst Gefactureerd":    "laatste_gefactureerd",
    "Enquete gestuurd":       "enquete_gestuurd",
    "Evaluatieformulier aanwezig?": "enquete_gestuurd",
}

def parse_datum(waarde):
    if waarde is None or (isinstance(waarde, float) and waarde != waarde):
        return None
    if isinstance(waarde, datetime):
        return waarde.date()
    s = str(waarde).strip()
    if not s or s.lower() in ('nan', 'none', '-', ''):
        return None
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except Exception:
            continue
    return None

def parse_float(waarde):
    if waarde is None or (isinstance(waarde, float) and waarde != waarde):
        return None
    try:
        return float(str(waarde).replace(',', '.').strip())
    except Exception:
        return None

def parse_str(waarde):
    if waarde is None:
        return None
    s = str(waarde).strip()
    if s.lower() in ('nan', 'none', ''):
        return None
    return s

DATUMVELDEN = {'geboortedatum', 'datum_start', 'einde_beschikking', 'datum_sluiting'}
FLOATVELDEN = {'bedrag_beschikt', 'gefactureerd', 'betaald'}

@router.post("/import", dependencies=[admin_only])
async def import_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "Alleen .xlsx of .xls bestanden zijn toegestaan")

    inhoud = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(inhoud), data_only=True)
    except Exception:
        raise HTTPException(400, "Ongeldig Excel-bestand")

    # Zoek het juiste tabblad
    blad = None
    for naam in ['Client informatie', 'Clienten', 'Cliënten', 'Sheet1']:
        if naam in wb.sheetnames:
            blad = wb[naam]
            break
    if blad is None:
        blad = wb.active

    rijen = list(blad.iter_rows(values_only=True))
    if not rijen:
        raise HTTPException(400, "Het bestand bevat geen gegevens")

    # Detecteer headerrij (eerste rij met meerdere niet-lege cellen)
    header_idx = 0
    for i, rij in enumerate(rijen[:5]):
        gevuld = [c for c in rij if c is not None and str(c).strip()]
        if len(gevuld) >= 3:
            header_idx = i
            break

    headers = [str(c).strip() if c is not None else '' for c in rijen[header_idx]]

    # Bouw kolomindex op basis van koppeling
    kolom_map = {}
    for i, header in enumerate(headers):
        if header in KOLOMKOPPELING:
            veld = KOLOMKOPPELING[header]
            if veld not in kolom_map:
                kolom_map[veld] = i

    if 'naam' not in kolom_map:
        raise HTTPException(400, "Kolom 'Client naam' of 'Naam' niet gevonden in het bestand")

    toegevoegd = 0
    overgeslagen = 0
    fouten = []

    for rij_nr, rij in enumerate(rijen[header_idx + 1:], start=header_idx + 2):
        # Sla lege rijen over
        if all(c is None or str(c).strip() in ('', 'nan') for c in rij):
            continue

        data = {}
        for veld, idx in kolom_map.items():
            if idx >= len(rij):
                continue
            waarde = rij[idx]
            if veld in DATUMVELDEN:
                data[veld] = parse_datum(waarde)
            elif veld in FLOATVELDEN:
                data[veld] = parse_float(waarde)
            else:
                data[veld] = parse_str(waarde)

        naam = data.get('naam')
        if not naam:
            overgeslagen += 1
            continue

        try:
            client = Client(
                naam=naam,
                bsn=data.get('bsn'),
                geboortedatum=data.get('geboortedatum'),
                status=data.get('status') or 'Aangemeld',
                klant=data.get('klant'),
                locatie=data.get('locatie'),
                begeleider_1=data.get('begeleider_1'),
                begeleider_2=data.get('begeleider_2'),
                datum_start=data.get('datum_start'),
                einde_beschikking=data.get('einde_beschikking'),
                datum_sluiting=data.get('datum_sluiting'),
                bedrag_beschikt=data.get('bedrag_beschikt'),
                gefactureerd=data.get('gefactureerd'),
                betaald=data.get('betaald'),
                uur_per_week=data.get('uur_per_week'),
                laatste_gefactureerd=data.get('laatste_gefactureerd'),
                enquete_gestuurd=data.get('enquete_gestuurd'),
                opmerkingen=data.get('opmerkingen'),
            )
            db.add(client)
            await db.flush()

            db.add(AuditLog(
                client_id=client.id,
                client_naam=naam,
                user_id=user.id,
                user_naam=user.naam,
                type=AuditType.add,
                actie="Cliënt geimporteerd via Excel",
            ))
            toegevoegd += 1
        except Exception as e:
            fouten.append("Rij {}: {}".format(rij_nr, str(e)))
            overgeslagen += 1

    await db.commit()

    return {
        "toegevoegd": toegevoegd,
        "overgeslagen": overgeslagen,
        "fouten": fouten[:10],
        "bericht": "{} cliënten geïmporteerd, {} overgeslagen".format(toegevoegd, overgeslagen),
    }

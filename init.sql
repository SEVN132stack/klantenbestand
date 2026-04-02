-- ─── Extensies ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum typen ───────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'bewerker', 'alleen_lezen');
CREATE TYPE client_status AS ENUM (
    'In zorg', 'Uit Zorg', 'Aangemeld', 'In ZTO',
    'Afronden', 'Nieuwe beschikking aanvragen'
);
CREATE TYPE audit_type AS ENUM ('add', 'edit', 'delete', 'note', 'status');

-- ─── Gebruikers ───────────────────────────────────────────────────────────────
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    naam        VARCHAR(150) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role        user_role NOT NULL DEFAULT 'alleen_lezen',
    actief      BOOLEAN NOT NULL DEFAULT true,
    aangemaakt  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    laatst_ingelogd TIMESTAMPTZ
);

-- ─── Configuratielijsten ──────────────────────────────────────────────────────
CREATE TABLE config_items (
    id          SERIAL PRIMARY KEY,
    categorie   VARCHAR(50) NOT NULL,   -- 'locatie','begeleider','status','klant','product','eenheid'
    waarde      VARCHAR(200) NOT NULL,
    volgorde    INT NOT NULL DEFAULT 0,
    UNIQUE(categorie, waarde)
);

-- ─── Cliënten ─────────────────────────────────────────────────────────────────
CREATE TABLE clienten (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    naam            VARCHAR(150) NOT NULL,
    bsn             VARCHAR(9),
    geboortedatum   DATE,
    status          client_status NOT NULL DEFAULT 'Aangemeld',
    klant           VARCHAR(150),
    locatie         VARCHAR(100),
    begeleider_1    VARCHAR(100),
    begeleider_2    VARCHAR(100),
    datum_start     DATE,
    einde_beschikking DATE,
    datum_sluiting  DATE,
    bedrag_beschikt NUMERIC(10,2),
    gefactureerd    NUMERIC(10,2),
    betaald         NUMERIC(10,2),
    uur_per_week    VARCHAR(20),
    enquete_gestuurd VARCHAR(10),
    opmerkingen     TEXT,
    notitie         TEXT,
    aangemaakt      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bijgewerkt      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   UUID REFERENCES clienten(id) ON DELETE SET NULL,
    client_naam VARCHAR(150),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    user_naam   VARCHAR(150) NOT NULL,
    type        audit_type NOT NULL,
    actie       TEXT NOT NULL,
    veld        VARCHAR(100),
    oude_waarde TEXT,
    nieuwe_waarde TEXT,
    tijdstip    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexen ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_audit_client ON audit_log(client_id);
CREATE INDEX idx_audit_tijdstip ON audit_log(tijdstip DESC);
CREATE INDEX idx_clienten_status ON clienten(status);
CREATE INDEX idx_clienten_naam ON clienten(naam);

-- ─── Trigger: bijgewerkt timestamp ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_bijgewerkt()
RETURNS TRIGGER AS $$
BEGIN NEW.bijgewerkt = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clienten_bijgewerkt
BEFORE UPDATE ON clienten
FOR EACH ROW EXECUTE FUNCTION set_bijgewerkt();

-- ─── Standaard configuratiewaarden ───────────────────────────────────────────
INSERT INTO config_items (categorie, waarde, volgorde) VALUES
  ('locatie','Smederij',1),('locatie','Ambulant',2),('locatie','TFR',3),
  ('locatie','Dagbesteding',4),('locatie','Stage',5),
  ('begeleider','Lennart',1),('begeleider','Floris',2),('begeleider','Taru',3),
  ('begeleider','Britt',4),('begeleider','Olger',5),('begeleider','Bente',6),
  ('begeleider','Laurien',7),('begeleider','Jantine',8),('begeleider','Claire',9),
  ('klant','Dronten',1),('klant','Kampen',2),('klant','Zwolle',3),
  ('klant','Intern',4),('klant','Klaver4You',5),('klant','RIBW',6),
  ('klant','PGB',7),('klant','Gemeente Olst-Wijhe',8),
  ('klant','Boslust Dependance de Laarakkers',9),('klant','Stapsgewijs',10),
  ('klant','Gemeente Lelystad',11),('klant','Gemeente Hardenberg',12),
  ('klant','Menso',13),('klant','Gemeente Aa en Hunze',14),
  ('product','Individueel',1),('product','Dagbesteding',2),
  ('eenheid','Maand',1),('eenheid','Week',2),('eenheid','Dagdeel',3),
  ('eenheid','Uur',4),('eenheid','Minuut',5);

-- ─── Standaard admin gebruiker ────────────────────────────────────────────────
-- Wachtwoord: Admin1234! (wijzig direct na eerste login)
INSERT INTO users (naam, email, password_hash, role) VALUES
  ('Beheerder', 'admin@organisatie.nl',
   crypt('Admin1234!', gen_salt('bf', 12)),
   'admin');

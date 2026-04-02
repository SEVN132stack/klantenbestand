#!/usr/bin/env python3
"""
Draait eenmalig bij het opstarten van de backend.
Maakt de standaard admin gebruiker aan als die nog niet bestaat.
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, text
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DATABASE_URL = os.environ["DATABASE_URL"].replace(
    "postgresql://", "postgresql+asyncpg://"
)

async def main():
    engine = create_async_engine(DATABASE_URL)

    # Wacht tot de database klaar is
    for i in range(30):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            break
        except Exception:
            print(f"Wachten op database... ({i+1}/30)")
            await asyncio.sleep(2)

    async with engine.begin() as conn:
        # Maak tabel aan als die nog niet bestaat
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                naam VARCHAR(150) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'alleen_lezen',
                actief BOOLEAN NOT NULL DEFAULT true,
                aangemaakt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                laatst_ingelogd TIMESTAMPTZ
            )
        """))

        # Controleer of admin al bestaat
        result = await conn.execute(
            text("SELECT id FROM users WHERE email = 'admin@organisatie.nl'")
        )
        if result.fetchone() is None:
            password_hash = pwd_context.hash("Admin123")
            await conn.execute(text("""
                INSERT INTO users (naam, email, password_hash, role)
                VALUES ('Beheerder', 'admin@organisatie.nl', :hash, 'admin')
            """), {"hash": password_hash})
            print("Admin gebruiker aangemaakt: admin@organisatie.nl / Admin123")
        else:
            print("Admin gebruiker bestaat al.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

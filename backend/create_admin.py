#!/usr/bin/env python3
import asyncio
import os
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ["DATABASE_URL"].replace(
    "postgresql://", "postgresql+asyncpg://"
)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

async def main():
    engine = create_async_engine(DATABASE_URL)

    for i in range(30):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            print("Database bereikbaar.")
            break
        except Exception:
            print(f"Wachten op database... ({i+1}/30)")
            await asyncio.sleep(2)

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
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

        result = await conn.execute(
            text("SELECT id FROM users WHERE email = 'admin@organisatie.nl'")
        )
        if result.fetchone() is None:
            pw_hash = hash_password("Admin123")
            await conn.execute(text("""
                INSERT INTO users (naam, email, password_hash, role)
                VALUES ('Beheerder', 'admin@organisatie.nl', :hash, 'admin')
            """), {"hash": pw_hash})
            print("Admin aangemaakt: admin@organisatie.nl / Admin123")
        else:
            print("Admin bestaat al.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import engine, Base
from .routers import auth, clienten, gebruikers, config, audit, export, beschikkingen, importeer

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Cliëntenportaal API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,          prefix="/api/auth",       tags=["Auth"])
app.include_router(clienten.router,      prefix="/api/clienten",   tags=["Clienten"])
app.include_router(gebruikers.router,    prefix="/api/gebruikers", tags=["Gebruikers"])
app.include_router(config.router,        prefix="/api/config",     tags=["Configuratie"])
app.include_router(audit.router,         prefix="/api/audit",      tags=["Audit"])
app.include_router(export.router,        prefix="/api/export",     tags=["Export"])
app.include_router(beschikkingen.router, prefix="/api/clienten",   tags=["Beschikkingen"])
app.include_router(importeer.router,     prefix="/api",            tags=["Import"])

@app.get("/api/health")
async def health():
    return {"status": "ok"}

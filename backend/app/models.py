import uuid
from datetime import datetime
from sqlalchemy import String, Text, Numeric, Date, DateTime, Boolean, Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from .database import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    bewerker = "bewerker"
    alleen_lezen = "alleen_lezen"

class AuditType(str, enum.Enum):
    add = "add"
    edit = "edit"
    delete = "delete"
    note = "note"
    status = "status"

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    naam: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.alleen_lezen)
    actief: Mapped[bool] = mapped_column(Boolean, default=True)
    aangemaakt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    laatst_ingelogd: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class ConfigItem(Base):
    __tablename__ = "config_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    categorie: Mapped[str] = mapped_column(String(50))
    waarde: Mapped[str] = mapped_column(String(200))
    volgorde: Mapped[int] = mapped_column(Integer, default=0)

class Client(Base):
    __tablename__ = "clienten"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    naam: Mapped[str] = mapped_column(String(150))
    bsn: Mapped[str | None] = mapped_column(String(9), nullable=True)
    geboortedatum: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Aangemeld")
    klant: Mapped[str | None] = mapped_column(String(150), nullable=True)
    locatie: Mapped[str | None] = mapped_column(String(100), nullable=True)
    begeleider_1: Mapped[str | None] = mapped_column(String(100), nullable=True)
    begeleider_2: Mapped[str | None] = mapped_column(String(100), nullable=True)
    datum_start: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    einde_beschikking: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    datum_sluiting: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    bedrag_beschikt: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    gefactureerd: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    betaald: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    uur_per_week: Mapped[str | None] = mapped_column(String(20), nullable=True)
    enquete_gestuurd: Mapped[str | None] = mapped_column(String(10), nullable=True)
    laatste_gefactureerd: Mapped[str | None] = mapped_column(String(20), nullable=True)
    facturatie_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    beschikking_bedrag: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    uren: Mapped[int | None] = mapped_column(Integer, nullable=True)
    minuten: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opmerkingen: Mapped[str | None] = mapped_column(Text, nullable=True)
    notitie: Mapped[str | None] = mapped_column(Text, nullable=True)
    aangemaakt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    bijgewerkt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="client", lazy="select")
    beschikkingen: Mapped[list["Beschikking"]] = relationship("Beschikking", back_populates="client", lazy="select", order_by="Beschikking.volgnummer")

class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clienten.id", ondelete="SET NULL"), nullable=True)
    client_naam: Mapped[str | None] = mapped_column(String(150), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_naam: Mapped[str] = mapped_column(String(150))
    type: Mapped[AuditType] = mapped_column(Enum(AuditType))
    actie: Mapped[str] = mapped_column(Text)
    veld: Mapped[str | None] = mapped_column(String(100), nullable=True)
    oude_waarde: Mapped[str | None] = mapped_column(Text, nullable=True)
    nieuwe_waarde: Mapped[str | None] = mapped_column(Text, nullable=True)
    tijdstip: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    client: Mapped["Client | None"] = relationship("Client", back_populates="audit_logs")

class Beschikking(Base):
    __tablename__ = "beschikkingen"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clienten.id", ondelete="CASCADE"), nullable=False)
    volgnummer: Mapped[int] = mapped_column(Integer, default=1)
    datum_start: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    datum_einde: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    bedrag_beschikt: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    gefactureerd: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    betaald: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    facturatie_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vast_bedrag: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    uren: Mapped[int | None] = mapped_column(Integer, nullable=True)
    minuten: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prijs_per_uur: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    prijs_per_minuut: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    aangemaakt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    client: Mapped["Client"] = relationship("Client", back_populates="beschikkingen")

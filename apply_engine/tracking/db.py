"""
apply_engine/tracking/db.py
────────────────────────────
Async SQLAlchemy engine + session factory.

Configuration (env vars):
    DATABASE_URL   — asyncpg connection string, e.g.
                     postgresql+asyncpg://postgres:password@db.xxxx.supabase.co:5432/postgres

    DATABASE_POOL_SIZE  (default: 5)
    DATABASE_MAX_OVERFLOW  (default: 10)
    DATABASE_POOL_RECYCLE  (default: 1800 seconds)

Usage:
    async with get_session() as session:
        result = await session.execute(select(Application))
        applications = result.scalars().all()
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


# ── Base class for all ORM models ─────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Engine singleton ──────────────────────────────────────────────────────────

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _build_engine() -> AsyncEngine:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Expected postgresql+asyncpg://user:pass@host:5432/db"
        )

    pool_size     = int(os.environ.get("DATABASE_POOL_SIZE", "5"))
    max_overflow  = int(os.environ.get("DATABASE_MAX_OVERFLOW", "10"))
    pool_recycle  = int(os.environ.get("DATABASE_POOL_RECYCLE", "1800"))

    return create_async_engine(
        url,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_recycle=pool_recycle,
        pool_pre_ping=True,
        echo=False,
    )


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = _build_engine()
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
    return _session_factory


@asynccontextmanager
async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield an async DB session; rolls back on exception, closes on exit."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def dispose_engine() -> None:
    """Gracefully close the connection pool (call on app shutdown)."""
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None

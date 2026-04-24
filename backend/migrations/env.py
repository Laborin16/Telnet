import asyncio
import re
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Importar todos los modelos para que autogenerate los detecte
from db.base import Base
import modules.auth.models        # noqa: F401
import modules.auditlog.models    # noqa: F401
import modules.finanzas.models    # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """Lee DATABASE_URL desde settings respetando .env y .env.local."""
    from core.config import settings
    return settings.database_url


def make_sync_url(async_url: str) -> str:
    """Convierte URL async a sync para el modo offline."""
    url = re.sub(r"\+asyncpg", "+psycopg2", async_url)
    url = re.sub(r"\+aiosqlite", "", url)
    return url


def run_migrations_offline() -> None:
    url = make_sync_url(get_url())
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(get_url(), poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

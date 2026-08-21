#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Alembic environment script.

Loads the project .env (backend/.env) so DATABASE_URL is available, then runs
migrations against the async SQLAlchemy engine using the project models metadata.
"""

import asyncio
import importlib
import pkgutil
from logging.config import fileConfig

import models
from alembic import context
from core.config import settings
from core.database import Base
from sqlalchemy import pool
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

# Automatically import all ORM models under Models
for _, module_name, _ in pkgutil.iter_modules(models.__path__):
    importlib.import_module(f"{models.__name__}.{module_name}")

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Prefer DATABASE_URL from the environment; fall back to the ini value.
database_url = settings.database_url or config.get_main_option("sqlalchemy.url")
if not database_url:
    raise RuntimeError(
        "DATABASE_URL is not configured. Set it in backend/.env before running migrations."
    )

# Normalize the URL to an async driver (postgresql+asyncpg) so the async engine
# works without psycopg2 installed.
_url = make_url(database_url)
if _url.drivername in ("postgresql", "postgres"):
    database_url = _url.set(drivername="postgresql+asyncpg").render_as_string(hide_password=False)
elif _url.drivername == "sqlite":
    database_url = _url.set(drivername="sqlite+aiosqlite").render_as_string(hide_password=False)

target_metadata = Base.metadata


def alembic_include_object(object, name, type_, reflected, compare_to):
    # type_ can be 'table', 'index', 'column', 'constraint'
    # ignore particular table_name
    if type_ == "table" and name in ["users", "sessions", "oidc_states"]:
        return False
    return True


def run_migrations_online():
    connectable = create_async_engine(database_url, poolclass=pool.NullPool)

    async def do_run_migrations(connection):
        await connection.run_sync(
            lambda sync_conn: context.configure(
                connection=sync_conn,
                target_metadata=target_metadata,
                compare_type=True,
                compare_server_default=True,
                include_object=alembic_include_object,
            )
        )
        async with connection.begin():
            await connection.run_sync(lambda sync_conn: context.run_migrations())

    async def run_async():
        async with connectable.connect() as connection:
            await do_run_migrations(connection)
        await connectable.dispose()

    asyncio.run(run_async())


def run_migrations():
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(run_migrations_online())
    except RuntimeError:
        run_migrations_online()


run_migrations()
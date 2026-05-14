"""add_supervisor_role

Revision ID: 2b8e1a4d3f0c
Revises: cb0d7c3eba79
Create Date: 2026-05-14 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = '2b8e1a4d3f0c'
down_revision: Union[str, Sequence[str], None] = 'cb0d7c3eba79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Solo aplica en PostgreSQL — SQLite no tiene tipos enum nativos
    if op.get_context().dialect.name == "postgresql":
        # IF NOT EXISTS evita error si la migracion se corre dos veces
        op.execute("ALTER TYPE rolusuario ADD VALUE IF NOT EXISTS 'supervisor'")


def downgrade() -> None:
    # PostgreSQL no permite eliminar valores de un enum sin reescribir todo el tipo.
    # Dejamos el valor en la BD; remover usuarios con rol 'supervisor' antes de bajar.
    pass

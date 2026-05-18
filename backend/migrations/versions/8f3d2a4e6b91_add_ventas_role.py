"""add_ventas_role

Revision ID: 8f3d2a4e6b91
Revises: 4a2cf91e5b7d
Create Date: 2026-05-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = '8f3d2a4e6b91'
down_revision: Union[str, Sequence[str], None] = '4a2cf91e5b7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Solo aplica en PostgreSQL — SQLite no tiene tipos enum nativos
    if op.get_context().dialect.name == "postgresql":
        # IF NOT EXISTS evita error si la migracion se corre dos veces
        op.execute("ALTER TYPE rolusuario ADD VALUE IF NOT EXISTS 'ventas'")


def downgrade() -> None:
    # PostgreSQL no permite eliminar valores de un enum sin reescribir todo el tipo.
    # Dejamos el valor en la BD; remover usuarios con rol 'ventas' antes de bajar.
    pass

"""add_bono_productividad

Revision ID: d4f7e2a91b58
Revises: c1a9d8b27e4f
Create Date: 2026-05-19 12:00:00.000000

Agrega:
- Columna `monto_bono` en `usuarios`
- Valor `BONO_PRODUCTIVIDAD` al enum `tipo_incidencia_nomina`
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4f7e2a91b58'
down_revision: Union[str, Sequence[str], None] = 'c1a9d8b27e4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.add_column(sa.Column('monto_bono', sa.Float(), nullable=True))

    if op.get_context().dialect.name == 'postgresql':
        # IF NOT EXISTS evita error si la migración se corre dos veces
        op.execute("ALTER TYPE tipo_incidencia_nomina ADD VALUE IF NOT EXISTS 'BONO_PRODUCTIVIDAD'")


def downgrade() -> None:
    # PostgreSQL no permite eliminar valores de un enum sin reescribir todo el tipo.
    # Dejamos el valor en la BD; remover incidencias con tipo BONO_PRODUCTIVIDAD antes de bajar.
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.drop_column('monto_bono')

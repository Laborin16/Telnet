"""add_incidencia_diferida

Revision ID: f3a1d97c6e84
Revises: e8c5b3f4d29a
Create Date: 2026-05-19 16:00:00.000000

Agrega `nomina_incidencias.diferida` para marcar cuotas de préstamo que el
empleado no pudo pagar esta semana (se posponen sin afectar el total).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a1d97c6e84'
down_revision: Union[str, Sequence[str], None] = 'e8c5b3f4d29a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('nomina_incidencias') as batch_op:
        batch_op.add_column(sa.Column('diferida', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table('nomina_incidencias') as batch_op:
        batch_op.drop_column('diferida')

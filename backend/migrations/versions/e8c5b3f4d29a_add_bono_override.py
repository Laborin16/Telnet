"""add_bono_override

Revision ID: e8c5b3f4d29a
Revises: d4f7e2a91b58
Create Date: 2026-05-19 14:00:00.000000

Agrega `nomina_registros.bono_override` para que admin pueda forzar
aplicar/quitar el bono manualmente, anulando el cálculo automático.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e8c5b3f4d29a'
down_revision: Union[str, Sequence[str], None] = 'd4f7e2a91b58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('nomina_registros') as batch_op:
        batch_op.add_column(sa.Column('bono_override', sa.String(length=20), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('nomina_registros') as batch_op:
        batch_op.drop_column('bono_override')

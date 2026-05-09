"""instalacion_datos_servicio_nullable

Revision ID: cb0d7c3eba79
Revises: f2ee5b76d7e6
Create Date: 2026-05-04 15:30:34.461868

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cb0d7c3eba79'
down_revision: Union[str, Sequence[str], None] = 'f2ee5b76d7e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("tareas") as batch_op:
        batch_op.add_column(sa.Column("datos_instalacion", sa.JSON(), nullable=True))
        batch_op.alter_column("id_servicio", existing_type=sa.INTEGER(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("tareas") as batch_op:
        batch_op.alter_column("id_servicio", existing_type=sa.INTEGER(), nullable=False)
        batch_op.drop_column("datos_instalacion")

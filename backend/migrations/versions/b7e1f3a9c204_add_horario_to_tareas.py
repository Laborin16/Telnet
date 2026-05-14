"""add_horario_to_tareas

Revision ID: b7e1f3a9c204
Revises: cb0d7c3eba79
Create Date: 2026-05-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7e1f3a9c204'
down_revision: Union[str, Sequence[str], None] = 'cb0d7c3eba79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tareas', sa.Column('fecha_inicio', sa.DateTime(), nullable=True))
    op.add_column('tareas', sa.Column('fecha_fin', sa.DateTime(), nullable=True))
    if op.get_context().dialect.name != 'sqlite':
        op.create_index(op.f('ix_tareas_fecha_inicio'), 'tareas', ['fecha_inicio'], unique=False)


def downgrade() -> None:
    if op.get_context().dialect.name != 'sqlite':
        op.drop_index(op.f('ix_tareas_fecha_inicio'), table_name='tareas')
    op.drop_column('tareas', 'fecha_fin')
    op.drop_column('tareas', 'fecha_inicio')

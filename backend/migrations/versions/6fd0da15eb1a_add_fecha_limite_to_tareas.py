"""add_fecha_limite_to_tareas

Revision ID: 6fd0da15eb1a
Revises: a379f0f58efc
Create Date: 2026-05-04 09:28:48.532068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6fd0da15eb1a'
down_revision: Union[str, Sequence[str], None] = 'a379f0f58efc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tareas', sa.Column('fecha_limite', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_tareas_fecha_limite'), 'tareas', ['fecha_limite'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_tareas_fecha_limite'), table_name='tareas')
    op.drop_column('tareas', 'fecha_limite')

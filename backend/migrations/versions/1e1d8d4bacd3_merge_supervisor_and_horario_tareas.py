"""merge_supervisor_and_horario_tareas

Revision ID: 1e1d8d4bacd3
Revises: 2b8e1a4d3f0c, b7e1f3a9c204
Create Date: 2026-05-14 15:57:28.635493

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1e1d8d4bacd3'
down_revision: Union[str, Sequence[str], None] = ('2b8e1a4d3f0c', 'b7e1f3a9c204')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

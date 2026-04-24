"""estado_inicial_esquema

Revision ID: dbf6b8c313e5
Revises: 
Create Date: 2026-04-22 18:15:48.486559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dbf6b8c313e5'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite trata VARCHAR y TEXT igual — solo aplica en PostgreSQL
    if op.get_context().dialect.name != "sqlite":
        op.alter_column('audit_logs', 'datos_extra',
                   existing_type=sa.VARCHAR(length=2000),
                   type_=sa.Text(),
                   existing_nullable=True)


def downgrade() -> None:
    if op.get_context().dialect.name != "sqlite":
        op.alter_column('audit_logs', 'datos_extra',
                   existing_type=sa.Text(),
                   type_=sa.VARCHAR(length=2000),
                   existing_nullable=True)

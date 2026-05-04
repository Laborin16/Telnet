"""add_suscripciones_push

Revision ID: fa712cc3cc19
Revises: 6fd0da15eb1a
Create Date: 2026-05-04 09:42:14.061430

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa712cc3cc19'
down_revision: Union[str, Sequence[str], None] = '6fd0da15eb1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('suscripciones_push',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('endpoint', sa.String(length=2048), nullable=False),
    sa.Column('p256dh', sa.String(length=512), nullable=False),
    sa.Column('auth', sa.String(length=256), nullable=False),
    sa.Column('user_agent', sa.String(length=512), nullable=False),
    sa.Column('creada', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suscripciones_push_usuario_id'), 'suscripciones_push', ['usuario_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_suscripciones_push_usuario_id'), table_name='suscripciones_push')
    op.drop_table('suscripciones_push')

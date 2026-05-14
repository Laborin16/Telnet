"""add_rol_usuario_replace_es_admin

Revision ID: f2ee5b76d7e6
Revises: fa712cc3cc19
Create Date: 2026-05-04 14:14:06.485680

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2ee5b76d7e6'
down_revision: Union[str, Sequence[str], None] = 'fa712cc3cc19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Agregar columna rol con default 'tecnico'
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.add_column(sa.Column('rol', sa.String(20), nullable=False, server_default='tecnico'))

    # 2. Migrar admins existentes (compatible con SQLite y PostgreSQL)
    op.execute("UPDATE usuarios SET rol = 'administrador' WHERE es_admin = TRUE")

    # 3. Eliminar es_admin
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.drop_column('es_admin')


def downgrade() -> None:
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.add_column(sa.Column('es_admin', sa.Boolean(), nullable=False, server_default='0'))

    op.execute("UPDATE usuarios SET es_admin = TRUE WHERE rol = 'administrador'")

    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.drop_column('rol')

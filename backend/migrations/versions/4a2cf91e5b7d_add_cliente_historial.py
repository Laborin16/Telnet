"""add_cliente_historial

Revision ID: 4a2cf91e5b7d
Revises: 1e1d8d4bacd3
Create Date: 2026-05-15 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4a2cf91e5b7d'
down_revision: Union[str, Sequence[str], None] = '1e1d8d4bacd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cliente_historial',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('id_servicio', sa.Integer(), nullable=False),
        sa.Column('tipo_evento', sa.String(length=50), nullable=False),
        sa.Column('fecha', sa.DateTime(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=True),
        sa.Column('usuario_nombre', sa.String(length=200), nullable=False, server_default='Sistema'),
        sa.Column('titulo', sa.String(length=200), nullable=False),
        sa.Column('descripcion', sa.String(length=1000), nullable=True),
        sa.Column('datos_extra', sa.Text(), nullable=True),
        sa.Column('tarea_id', sa.Integer(), nullable=True),
        sa.Column('pago_id', sa.Integer(), nullable=True),
    )
    if op.get_context().dialect.name != 'sqlite':
        op.create_index(op.f('ix_cliente_historial_id_servicio'), 'cliente_historial', ['id_servicio'], unique=False)
        op.create_index(op.f('ix_cliente_historial_tipo_evento'),  'cliente_historial', ['tipo_evento'],  unique=False)
        op.create_index(op.f('ix_cliente_historial_fecha'),        'cliente_historial', ['fecha'],        unique=False)
        op.create_index(op.f('ix_cliente_historial_usuario_id'),   'cliente_historial', ['usuario_id'],   unique=False)
        op.create_index(op.f('ix_cliente_historial_tarea_id'),     'cliente_historial', ['tarea_id'],     unique=False)
        op.create_index(op.f('ix_cliente_historial_pago_id'),      'cliente_historial', ['pago_id'],      unique=False)


def downgrade() -> None:
    if op.get_context().dialect.name != 'sqlite':
        op.drop_index(op.f('ix_cliente_historial_pago_id'),      table_name='cliente_historial')
        op.drop_index(op.f('ix_cliente_historial_tarea_id'),     table_name='cliente_historial')
        op.drop_index(op.f('ix_cliente_historial_usuario_id'),   table_name='cliente_historial')
        op.drop_index(op.f('ix_cliente_historial_fecha'),        table_name='cliente_historial')
        op.drop_index(op.f('ix_cliente_historial_tipo_evento'),  table_name='cliente_historial')
        op.drop_index(op.f('ix_cliente_historial_id_servicio'),  table_name='cliente_historial')
    op.drop_table('cliente_historial')

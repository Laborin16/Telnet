"""add_pagos_empresa

Revision ID: b3c9f1a72e04
Revises: a7b2e5f81c93
Create Date: 2026-05-19 22:00:00.000000

Crea las tablas para el módulo "Pagos por hacer" (gastos de la empresa):
- `pagos_empresa_categorias` (sub-tabs gestionables, soft delete vía `activa`)
- `pagos_empresa` (pagos por hacer, con recurrencia y soft delete)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c9f1a72e04'
down_revision: Union[str, Sequence[str], None] = 'a7b2e5f81c93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RECURRENCIA_VALUES = ('NINGUNA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'ANUAL')
ESTADO_VALUES = ('PENDIENTE', 'PAGADO')


def upgrade() -> None:
    op.create_table(
        'pagos_empresa_categorias',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('descripcion', sa.String(length=300), nullable=True),
        sa.Column('orden', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('activa', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('nombre', name='uq_pagos_empresa_cat_nombre'),
    )

    op.create_table(
        'pagos_empresa',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('categoria_id', sa.Integer(), nullable=False),
        sa.Column('concepto', sa.String(length=200), nullable=False),
        sa.Column('monto', sa.Numeric(12, 2), nullable=False),
        sa.Column('fecha_vencimiento', sa.Date(), nullable=False),
        sa.Column(
            'recurrencia',
            sa.Enum(*RECURRENCIA_VALUES, name='recurrencia_pago_empresa'),
            nullable=False, server_default='NINGUNA',
        ),
        sa.Column(
            'estado',
            sa.Enum(*ESTADO_VALUES, name='estado_pago_empresa'),
            nullable=False, server_default='PENDIENTE',
        ),
        sa.Column('proveedor', sa.String(length=200), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('comprobante_path', sa.String(length=500), nullable=True),
        sa.Column('fecha_pago', sa.DateTime(), nullable=True),
        sa.Column('recordatorio_enviado_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['categoria_id'], ['pagos_empresa_categorias.id']),
    )
    op.create_index('ix_pagos_empresa_categoria_id', 'pagos_empresa', ['categoria_id'])
    op.create_index('ix_pagos_empresa_fecha_vencimiento', 'pagos_empresa', ['fecha_vencimiento'])
    op.create_index('ix_pagos_empresa_estado_venc', 'pagos_empresa', ['estado', 'fecha_vencimiento'])
    op.create_index('ix_pagos_empresa_cat_estado',  'pagos_empresa', ['categoria_id', 'estado'])


def downgrade() -> None:
    op.drop_index('ix_pagos_empresa_cat_estado', table_name='pagos_empresa')
    op.drop_index('ix_pagos_empresa_estado_venc', table_name='pagos_empresa')
    op.drop_index('ix_pagos_empresa_fecha_vencimiento', table_name='pagos_empresa')
    op.drop_index('ix_pagos_empresa_categoria_id', table_name='pagos_empresa')
    op.drop_table('pagos_empresa')
    op.drop_table('pagos_empresa_categorias')

    if op.get_context().dialect.name == 'postgresql':
        op.execute("DROP TYPE IF EXISTS estado_pago_empresa")
        op.execute("DROP TYPE IF EXISTS recurrencia_pago_empresa")

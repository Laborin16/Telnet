"""add_nomina_module

Revision ID: c1a9d8b27e4f
Revises: 8f3d2a4e6b91
Create Date: 2026-05-18 17:00:00.000000

Agrega:
- Columnas sueldo_diario, area, en_nomina en `usuarios`
- Tablas nomina_periodos, nomina_registros, nomina_incidencias, nomina_prestamos
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1a9d8b27e4f'
down_revision: Union[str, Sequence[str], None] = '8f3d2a4e6b91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ESTADO_PERIODO_VALUES = ('BORRADOR', 'CERRADA')
TIPO_INCIDENCIA_VALUES = (
    'PERCEPCION_EXTRA', 'HORA_EXTRA', 'ADELANTO', 'CUOTA_PRESTAMO',
    'DESCUENTO_FALTA', 'DESCUENTO_RETARDO', 'DESCUENTO_BIEN', 'OTRO',
)
ESTADO_PRESTAMO_VALUES = ('ACTIVO', 'PAGADO', 'CANCELADO')


def upgrade() -> None:
    # ── 1. Columnas en usuarios ─────────────────────────────────────────────
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.add_column(sa.Column('sueldo_diario', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('area', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('en_nomina', sa.Boolean(), nullable=False, server_default=sa.false()))

    # ── 2. Tabla nomina_periodos ────────────────────────────────────────────
    op.create_table(
        'nomina_periodos',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('fecha_inicio', sa.Date(), nullable=False),
        sa.Column('fecha_fin', sa.Date(), nullable=False),
        sa.Column('estado',
                  sa.Enum(*ESTADO_PERIODO_VALUES, name='estado_periodo_nomina'),
                  nullable=False, server_default='BORRADOR'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('closed_by_usuario_id', sa.Integer(), nullable=True),
        sa.UniqueConstraint('fecha_inicio', name='uq_nomina_periodo_inicio'),
    )
    op.create_index('ix_nomina_periodos_fecha_inicio', 'nomina_periodos', ['fecha_inicio'])

    # ── 3. Tabla nomina_registros ───────────────────────────────────────────
    op.create_table(
        'nomina_registros',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('periodo_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('dia_1', sa.Float(), nullable=False, server_default='0'),
        sa.Column('dia_2', sa.Float(), nullable=False, server_default='0'),
        sa.Column('dia_3', sa.Float(), nullable=False, server_default='0'),
        sa.Column('dia_4', sa.Float(), nullable=False, server_default='0'),
        sa.Column('dia_5', sa.Float(), nullable=False, server_default='0'),
        sa.Column('dia_6', sa.Float(), nullable=False, server_default='0'),
        sa.Column('dia_7', sa.Float(), nullable=False, server_default='0'),
        sa.Column('horas_extra', sa.Float(), nullable=False, server_default='0'),
        sa.Column('sueldo_diario_aplicado', sa.Float(), nullable=True),
        sa.Column('notas', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['periodo_id'], ['nomina_periodos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id']),
        sa.UniqueConstraint('periodo_id', 'usuario_id', name='uq_nomina_periodo_usuario'),
    )
    op.create_index('ix_nomina_registros_periodo_id', 'nomina_registros', ['periodo_id'])
    op.create_index('ix_nomina_registros_usuario_id', 'nomina_registros', ['usuario_id'])

    # ── 4. Tabla nomina_prestamos ───────────────────────────────────────────
    op.create_table(
        'nomina_prestamos',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('monto_total', sa.Float(), nullable=False),
        sa.Column('cuota_semanal', sa.Float(), nullable=False),
        sa.Column('cuotas_totales', sa.Integer(), nullable=False),
        sa.Column('cuotas_pagadas', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fecha_inicio', sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column('estado',
                  sa.Enum(*ESTADO_PRESTAMO_VALUES, name='estado_prestamo_nomina'),
                  nullable=False, server_default='ACTIVO'),
        sa.Column('motivo', sa.String(length=300), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id']),
    )
    op.create_index('ix_nomina_prestamos_usuario_id', 'nomina_prestamos', ['usuario_id'])
    op.create_index('ix_nomina_prestamos_estado', 'nomina_prestamos', ['estado'])

    # ── 5. Tabla nomina_incidencias ─────────────────────────────────────────
    op.create_table(
        'nomina_incidencias',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('registro_id', sa.Integer(), nullable=False),
        sa.Column('tipo',
                  sa.Enum(*TIPO_INCIDENCIA_VALUES, name='tipo_incidencia_nomina'),
                  nullable=False),
        sa.Column('monto', sa.Float(), nullable=False),
        sa.Column('descripcion', sa.String(length=300), nullable=True),
        sa.Column('prestamo_id', sa.Integer(), nullable=True),
        sa.Column('auto_generada', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['registro_id'], ['nomina_registros.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['prestamo_id'], ['nomina_prestamos.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_nomina_incidencias_registro_id', 'nomina_incidencias', ['registro_id'])
    op.create_index('ix_nomina_incidencias_prestamo_id', 'nomina_incidencias', ['prestamo_id'])


def downgrade() -> None:
    op.drop_index('ix_nomina_incidencias_prestamo_id', table_name='nomina_incidencias')
    op.drop_index('ix_nomina_incidencias_registro_id', table_name='nomina_incidencias')
    op.drop_table('nomina_incidencias')

    op.drop_index('ix_nomina_prestamos_estado', table_name='nomina_prestamos')
    op.drop_index('ix_nomina_prestamos_usuario_id', table_name='nomina_prestamos')
    op.drop_table('nomina_prestamos')

    op.drop_index('ix_nomina_registros_usuario_id', table_name='nomina_registros')
    op.drop_index('ix_nomina_registros_periodo_id', table_name='nomina_registros')
    op.drop_table('nomina_registros')

    op.drop_index('ix_nomina_periodos_fecha_inicio', table_name='nomina_periodos')
    op.drop_table('nomina_periodos')

    # Tipos ENUM en PostgreSQL deben dropearse explícitamente
    if op.get_context().dialect.name == 'postgresql':
        op.execute("DROP TYPE IF EXISTS tipo_incidencia_nomina")
        op.execute("DROP TYPE IF EXISTS estado_prestamo_nomina")
        op.execute("DROP TYPE IF EXISTS estado_periodo_nomina")

    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.drop_column('en_nomina')
        batch_op.drop_column('area')
        batch_op.drop_column('sueldo_diario')

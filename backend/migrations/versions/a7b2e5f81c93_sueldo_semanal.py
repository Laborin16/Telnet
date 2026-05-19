"""rename sueldo_diario to sueldo_semanal

Revision ID: a7b2e5f81c93
Revises: f3a1d97c6e84
Create Date: 2026-05-19 18:00:00.000000

- Renombra `usuarios.sueldo_diario` → `usuarios.sueldo_semanal`
- Renombra `nomina_registros.sueldo_diario_aplicado` → `sueldo_semanal_aplicado`
- Convierte valores existentes multiplicando por 6 (porque la nómina paga 6 días)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b2e5f81c93'
down_revision: Union[str, Sequence[str], None] = 'f3a1d97c6e84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.alter_column('sueldo_diario', new_column_name='sueldo_semanal')
    op.execute("UPDATE usuarios SET sueldo_semanal = sueldo_semanal * 6 WHERE sueldo_semanal IS NOT NULL")

    with op.batch_alter_table('nomina_registros') as batch_op:
        batch_op.alter_column('sueldo_diario_aplicado', new_column_name='sueldo_semanal_aplicado')
    op.execute("UPDATE nomina_registros SET sueldo_semanal_aplicado = sueldo_semanal_aplicado * 6 WHERE sueldo_semanal_aplicado IS NOT NULL")


def downgrade() -> None:
    op.execute("UPDATE nomina_registros SET sueldo_semanal_aplicado = sueldo_semanal_aplicado / 6.0 WHERE sueldo_semanal_aplicado IS NOT NULL")
    with op.batch_alter_table('nomina_registros') as batch_op:
        batch_op.alter_column('sueldo_semanal_aplicado', new_column_name='sueldo_diario_aplicado')

    op.execute("UPDATE usuarios SET sueldo_semanal = sueldo_semanal / 6.0 WHERE sueldo_semanal IS NOT NULL")
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.alter_column('sueldo_semanal', new_column_name='sueldo_diario')

"""add is_developer column to users

Revision ID: 3617d7e7eb83
Revises: 
Create Date: 2026-08-19 16:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3617d7e7eb83'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_developer column to users table."""
    op.add_column('users', sa.Column('is_developer', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    """Drop is_developer column from users table."""
    op.drop_column('users', 'is_developer')
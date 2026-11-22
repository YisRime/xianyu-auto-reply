"""
SQLAlchemy基类定义

功能：
1. 定义所有模型的基类Base
2. 提供时间戳混入类TimestampMixin
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column




@compiles(BigInteger, "sqlite")
def _compile_bigint_for_sqlite(type_, compiler, **kw):
    """SQLite 只有 INTEGER PRIMARY KEY 才会自增，BIGINT 主键需降级为 INTEGER。"""
    return "INTEGER"

class Base(DeclarativeBase):
    """Base declarative class."""


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class TaskRow(Base):
    """tasks 테이블. 값 규칙은 API-SPEC.md의 Task 객체와 같다."""

    __tablename__ = "tasks"
    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 할 일 소유자. backend/add_task_owner.py가 기존 행을 첫 회원가입 계정으로 귀속시킨다.
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="", server_default="")
    status: Mapped[str] = mapped_column(
        Enum("TODO", "DOING", "DONE", name="task_status"),
        nullable=False,
        default="TODO",
        server_default="TODO",
    )
    priority: Mapped[str] = mapped_column(
        Enum("HIGH", "NORMAL", "LOW", name="task_priority"),
        nullable=False,
        default="NORMAL",
        server_default="NORMAL",
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # 완료 여부와 별개로 사용자가 직접 ARCHIVE로 보관 처리했는지 나타낸다(F14).
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    # UTC 기준 등록 일시. 시간대 정보 없이 저장하고 API 응답에서 UTC로 표시한다.
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class UserRow(Base):
    """users 테이블. 아이디 회원가입·로그인에 사용한다."""

    __tablename__ = "users"
    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    # bcrypt 해시 문자열을 저장한다. 평문 비밀번호는 저장하지 않는다.
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

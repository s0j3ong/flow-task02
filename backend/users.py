from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .database import SessionLocal
from .models import UserRow
from .schemas import User
from .security import verify_password


class UsernameAlreadyRegistered(Exception):
    """이미 등록된 아이디로 회원가입을 시도했을 때 발생한다."""


def to_user(row: UserRow) -> User:
    return User(id=row.id, username=row.username, created_at=row.created_at.replace(tzinfo=timezone.utc))


class DbUserStore:
    """MariaDB users 테이블에 사용자를 저장한다."""

    def create(self, username: str, password_hash: str) -> User:
        row = UserRow(
            username=username,
            password_hash=password_hash,
            created_at=datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None),
        )
        with SessionLocal() as session, session.begin():
            session.add(row)
            try:
                session.flush()
            except IntegrityError as error:
                raise UsernameAlreadyRegistered(username) from error
            return to_user(row)

    def authenticate(self, username: str, password: str) -> User | None:
        """아이디·비밀번호가 맞으면 사용자를 반환하고, 아니면 None을 반환한다."""
        with SessionLocal() as session:
            row = session.scalar(select(UserRow).where(UserRow.username == username))
            if row is None or not verify_password(password, row.password_hash):
                return None
            return to_user(row)

    def get(self, user_id: int) -> User | None:
        with SessionLocal() as session:
            row = session.get(UserRow, user_id)
            return to_user(row) if row is not None else None

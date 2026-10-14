from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import func, select

from .database import SessionLocal
from .models import TaskRow
from .schemas import Priority, Status, Task, TaskCreate


def to_task(row: TaskRow) -> Task:
    """DB 행을 API 응답 모델로 바꾼다. created_at은 UTC로 저장되어 있다."""
    return Task(
        id=row.id,
        title=row.title,
        description=row.description,
        status=row.status,
        priority=row.priority,
        due_date=row.due_date,
        archived=row.archived,
        created_at=row.created_at.replace(tzinfo=timezone.utc),
    )


def to_column_value(value: object) -> object:
    # Status·Priority 같은 Enum은 DB ENUM 컬럼에 맞게 문자열 값으로 저장한다.
    return value.value if isinstance(value, Enum) else value


class DbTaskStore:
    """MariaDB tasks 테이블에 할 일을 저장한다. API를 재시작해도 데이터가 유지된다.

    모든 조회·수정·삭제는 user_id로 소유자를 확인한다. 다른 사용자의 할 일은
    존재 자체를 알려주지 않기 위해 없는 id와 같은 결과(빈 목록, None, False)를 돌려준다.
    """

    def list(
        self,
        user_id: int,
        q: str | None = None,
        status: Status | None = None,
        priority: Priority | None = None,
    ) -> list[Task]:
        """조건을 모두 만족하는 할 일을 id 순서로 반환한다. None 조건은 무시한다."""
        statement = select(TaskRow).where(TaskRow.user_id == user_id).order_by(TaskRow.id)
        query = (q or "").strip().lower()
        if query:
            # %, _ 를 글자 그대로 검색하고, DB 정렬 규칙과 관계없이 소문자로 비교한다.
            statement = statement.where(
                func.lower(TaskRow.title).collate("utf8mb4_bin").contains(query, autoescape=True)
            )
        if status is not None:
            statement = statement.where(TaskRow.status == status.value)
        if priority is not None:
            statement = statement.where(TaskRow.priority == priority.value)
        with SessionLocal() as session:
            return [to_task(row) for row in session.scalars(statement)]

    def create(self, user_id: int, data: TaskCreate) -> Task:
        row = TaskRow(
            user_id=user_id,
            title=data.title,
            description=data.description,
            status=Status.TODO.value,
            priority=data.priority.value,
            due_date=data.due_date,
            created_at=datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None),
        )
        with SessionLocal() as session, session.begin():
            session.add(row)
            session.flush()
            return to_task(row)

    def update(self, user_id: int, task_id: int, changes: dict[str, object]) -> Task | None:
        """전달된 필드만 바꾼다. 없는 id이거나 다른 사용자의 id면 None을 반환한다."""
        with SessionLocal() as session, session.begin():
            row = session.get(TaskRow, task_id)
            if row is None or row.user_id != user_id:
                return None
            for name, value in changes.items():
                setattr(row, name, to_column_value(value))
            session.flush()
            return to_task(row)

    def delete(self, user_id: int, task_id: int) -> bool:
        """삭제했으면 True, 없는 id이거나 다른 사용자의 id면 False를 반환한다."""
        with SessionLocal() as session, session.begin():
            row = session.get(TaskRow, task_id)
            if row is None or row.user_id != user_id:
                return False
            session.delete(row)
            return True

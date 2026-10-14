"""tasks.archived 컬럼을 추가한다. 기존 행은 모두 false(보관 안 함)로 채워진다.
이미 있으면 다시 추가하지 않는다(멱등).

실행: python -m backend.add_task_archived
"""

from sqlalchemy import inspect, text

from .database import engine


def main() -> None:
    columns = {col["name"] for col in inspect(engine).get_columns("tasks")}
    if "archived" in columns:
        print("tasks.archived 컬럼이 이미 있어 추가하지 않았습니다.")
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE tasks ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE"))
    print("tasks.archived 컬럼을 추가했습니다(기존 행은 모두 false).")


if __name__ == "__main__":
    main()

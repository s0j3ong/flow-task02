"""tasks.user_id 컬럼을 추가하고 기존 행을 첫 회원가입 계정으로 귀속시킨다.
회원가입한 계정이 없으면 귀속을 건너뛰고 안내만 출력한다(다시 실행해 완료한다).
이미 적용된 부분은 다시 실행하지 않는다.

실행: python -m backend.add_task_owner
"""

from sqlalchemy import inspect, text

from .database import engine


def main() -> None:
    columns = {col["name"]: col for col in inspect(engine).get_columns("tasks")}

    if "user_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN user_id INT NULL"))
        print("tasks.user_id 컬럼을 추가했습니다.")
    else:
        print("tasks.user_id 컬럼이 이미 있어 추가하지 않았습니다.")

    with engine.begin() as conn:
        orphan_count = conn.execute(text("SELECT COUNT(*) FROM tasks WHERE user_id IS NULL")).scalar()

    if orphan_count > 0:
        with engine.begin() as conn:
            first_user = conn.execute(text("SELECT id, username FROM users ORDER BY id LIMIT 1")).fetchone()
            if first_user is None:
                print(
                    f"회원가입 계정이 없어 {orphan_count}건을 귀속하지 못했습니다. "
                    "먼저 회원가입한 뒤 다시 실행하세요."
                )
                return
            conn.execute(text("UPDATE tasks SET user_id = :uid WHERE user_id IS NULL"), {"uid": first_user.id})
        print(f"기존 할 일 {orphan_count}건을 '{first_user.username}' 계정(id={first_user.id})으로 귀속했습니다.")
    else:
        print("귀속이 필요한 할 일이 없습니다.")

    columns = {col["name"]: col for col in inspect(engine).get_columns("tasks")}
    with engine.begin() as conn:
        if columns["user_id"]["nullable"]:
            conn.execute(text("ALTER TABLE tasks MODIFY user_id INT NOT NULL"))
            print("user_id를 NOT NULL로 변경했습니다.")
        else:
            print("user_id가 이미 NOT NULL입니다.")

        fks = inspect(engine).get_foreign_keys("tasks")
        if not any(fk["referred_table"] == "users" for fk in fks):
            conn.execute(
                text("ALTER TABLE tasks ADD CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id) REFERENCES users(id)")
            )
            print("user_id 외래 키 제약을 추가했습니다.")
        else:
            print("user_id 외래 키 제약이 이미 있어 추가하지 않았습니다.")


if __name__ == "__main__":
    main()

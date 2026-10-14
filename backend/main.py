import logging
import os

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.sessions import SessionMiddleware

from .database import ENV_FILE, read_env_file
from .schemas import Priority, Status, Task, TaskCreate, TaskUpdate, User, UserCreate, UserLogin
from .security import hash_password
from .store import DbTaskStore
from .users import DbUserStore, UsernameAlreadyRegistered

app = FastAPI(title="Task Flow API")
store = DbTaskStore()
user_store = DbUserStore()
logger = logging.getLogger(__name__)

TASK_NOT_FOUND = "할 일을 찾을 수 없습니다."
DATABASE_ERROR = "DB에 연결할 수 없거나 처리 중 오류가 발생했습니다."
USERNAME_ALREADY_REGISTERED = "이미 등록된 아이디입니다."
LOGIN_FAILED = "아이디 또는 비밀번호가 올바르지 않습니다."
NOT_AUTHENTICATED = "로그인이 필요합니다."


def load_session_secret() -> str:
    """세션 쿠키 서명용 비밀 값을 .env 또는 환경변수에서 읽는다."""
    env_values = read_env_file(ENV_FILE)
    secret = os.environ.get("SESSION_SECRET_KEY", env_values.get("SESSION_SECRET_KEY", ""))
    if not secret:
        raise RuntimeError(
            "SESSION_SECRET_KEY가 없습니다. .env.example을 참고해 .env 또는 환경변수를 설정하세요."
        )
    return secret


app.add_middleware(
    SessionMiddleware,
    secret_key=load_session_secret(),
    session_cookie="task_flow_session",
    same_site="lax",
    https_only=False,
    max_age=60 * 60 * 24,
)


@app.exception_handler(SQLAlchemyError)
def handle_database_error(request: Request, error: SQLAlchemyError) -> JSONResponse:
    """DB 오류는 내부 내용을 응답에 노출하지 않고 503으로 알린다. 자세한 내용은 서버 로그에 남긴다."""
    logger.error("DB 오류: %s %s: %s", request.method, request.url.path, error)
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": DATABASE_ERROR})


@app.get("/api/health")
def health() -> dict[str, str]:
    """API 서버가 요청을 처리할 수 있는지 확인한다."""
    return {"status": "ok"}


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(data: UserCreate) -> User:
    """아이디와 비밀번호로 회원가입한다. 비밀번호는 해시로 저장한다."""
    try:
        return user_store.create(data.username, hash_password(data.password))
    except UsernameAlreadyRegistered:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=USERNAME_ALREADY_REGISTERED)


@app.post("/api/auth/login")
def login(data: UserLogin, request: Request) -> User:
    """아이디·비밀번호가 맞으면 세션 쿠키를 내려준다."""
    user = user_store.authenticate(data.username, data.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=LOGIN_FAILED)
    request.session["user_id"] = user.id
    return user


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> None:
    """세션을 끝낸다. 이미 로그인하지 않은 상태면 401."""
    if "user_id" not in request.session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=NOT_AUTHENTICATED)
    request.session.clear()


def require_user(request: Request) -> int:
    """로그인한 사용자의 id를 반환한다. 로그인하지 않았으면 401."""
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=NOT_AUTHENTICATED)
    return user_id


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    status: Status | None = None,
    priority: Priority | None = None,
    user_id: int = Depends(require_user),
) -> list[Task]:
    """로그인한 사용자의 할 일 중 제목 검색(q)과 상태·우선순위 필터를 AND로 적용해 등록 순서로 반환한다."""
    return store.list(user_id, q=q, status=status, priority=priority)


@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, user_id: int = Depends(require_user)) -> Task:
    """할 일을 등록한다. 상태는 항상 TODO로 시작한다."""
    return store.create(user_id, data)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate, user_id: int = Depends(require_user)) -> Task:
    """보낸 필드만 수정하고 나머지는 유지한다. 다른 사용자의 할 일이면 404."""
    task = store.update(user_id, task_id, data.changes())
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TASK_NOT_FOUND)
    return task


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user_id: int = Depends(require_user)) -> None:
    """할 일을 삭제한다. 다른 사용자의 할 일이면 404."""
    if not store.delete(user_id, task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TASK_NOT_FOUND)

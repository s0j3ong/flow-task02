# Task Flow API 명세

PRD.md의 요구사항을 API 계약으로 정리한다. 구현 순서는 PLAN.md(T05~T08)를 따른다.

## 공통
- 기본 주소: `http://127.0.0.1:8000` (개발), 모든 경로는 `/api`로 시작한다.
- 요청·응답 본문은 JSON(UTF-8)이다.
- 날짜는 `YYYY-MM-DD`, 일시는 ISO 8601 UTC 문자열(예: `2026-10-13T05:12:30Z`)이다.
- 오류 응답은 FastAPI 기본 형식 `{"detail": ...}`을 사용한다.

| 상태 코드 | 의미 |
|---|---|
| 200 | 조회·수정 성공 |
| 201 | 등록 성공 |
| 204 | 삭제 성공(본문 없음) |
| 401 | 로그인 필요 또는 아이디·비밀번호 불일치 |
| 404 | 해당 id의 할 일이 없음 |
| 422 | 입력값 검증 실패 |
| 503 | DB 연결 실패 또는 DB 처리 오류. 응답: `{"detail": "DB에 연결할 수 없거나 처리 중 오류가 발생했습니다."}` |

## Task 객체

| 필드 | 타입 | 규칙 | 기본값 |
|---|---|---|---|
| id | 정수 | 서버가 발급하는 고유 값. 수정·삭제는 id로 처리한다. | - |
| title | 문자열 | 앞뒤 공백 제거 후 1~100자 | 필수 |
| description | 문자열 | 최대 2000자 | `""` |
| status | 문자열 | `TODO`, `DOING`, `DONE` | `TODO` |
| priority | 문자열 | `HIGH`, `NORMAL`, `LOW` | `NORMAL` |
| due_date | 문자열 또는 null | 실제 존재하는 `YYYY-MM-DD` 날짜, 미지정은 null | `null` |
| archived | 불리언 | 사용자가 ARCHIVE로 보관 처리했는지(T18 이후, F14). 완료(DONE) 여부와는 별개 값이며 자동으로 바뀌지 않는다 | `false` |
| created_at | 문자열 | 등록 시 서버가 기록하는 UTC 일시 | - |

```json
{
  "id": 1,
  "title": "보고서 작성",
  "description": "",
  "status": "TODO",
  "priority": "HIGH",
  "due_date": "2026-10-20",
  "archived": false,
  "created_at": "2026-10-13T05:12:30Z"
}
```

- 정의되지 않은 필드를 보내면 422로 거절한다.
- 지연 여부는 사용자의 로컬 날짜가 필요하므로 API가 아닌 화면에서 계산한다.

## 엔드포인트

### GET /api/health  (T05)
API 서버 상태를 확인한다.
- 응답 200: `{"status": "ok"}`

## 사용자(User) 객체

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | 정수 | 서버가 발급하는 고유 값 |
| username | 문자열 | 영문 소문자·숫자·밑줄(`_`), 4~20자, 중복 불가 |
| created_at | 문자열 | 가입 시 서버가 기록하는 UTC 일시 |

비밀번호 해시는 응답에 포함하지 않는다.

### POST /api/auth/signup  (T16)
아이디와 비밀번호로 회원가입한다.

```json
{ "username": "tester01", "password": "password123" }
```

- `username`: 영문 소문자·숫자·`_`, 4~20자. `password`: 8자 이상.
- 응답 201: 등록된 `User`.
- 검증 실패(형식, 길이) 422. 이미 등록된 아이디 422.

### POST /api/auth/login  (T17)
아이디와 비밀번호로 로그인하고 세션 쿠키를 발급한다.

```json
{ "username": "tester01", "password": "password123" }
```

- 응답 200: 로그인한 `User`. `Set-Cookie: task_flow_session=...`(HttpOnly, 서명됨, 24시간).
- 아이디가 없거나 비밀번호가 틀리면 401: `{"detail": "아이디 또는 비밀번호가 올바르지 않습니다."}` (어느 쪽이 틀렸는지는 구분해 알려주지 않는다)
- 검증 실패(정의되지 않은 필드 등) 422.

### POST /api/auth/logout  (T17)
현재 세션을 끝낸다.
- 응답 204(본문 없음).
- 로그인하지 않은 상태(쿠키 없음 또는 이미 로그아웃)면 401: `{"detail": "로그인이 필요합니다."}`

### GET /api/tasks  (T06, 필터는 T07, 로그인 필요는 T18)
로그인한 사용자의 할 일 목록을 등록 순서(id 오름차순)로 반환한다.

| 쿼리 | 설명 |
|---|---|
| q | 제목에 포함된 글자(대소문자 무시, 앞뒤 공백 제거). 비어 있으면 조건 없음 |
| status | `TODO`, `DOING`, `DONE` 중 하나 |
| priority | `HIGH`, `NORMAL`, `LOW` 중 하나 |

- 여러 조건은 AND로 적용한다.
- 응답 200: `Task` 배열. 조건에 맞는 항목이 없으면 `[]`.
- 허용되지 않은 status·priority 값은 422. 로그인하지 않았으면 401.

### POST /api/tasks  (T06, 로그인 필요는 T18)
로그인한 사용자 소유로 할 일을 등록한다.

```json
{
  "title": "보고서 작성",
  "description": "1장 초안",
  "priority": "HIGH",
  "due_date": "2026-10-20"
}
```

- `title`만 필수이며 나머지는 생략하면 기본값을 쓴다. status는 항상 `TODO`로 시작한다.
- 응답 201: 등록된 `Task`.
- 검증 실패 422. 로그인하지 않았으면 401.

### PATCH /api/tasks/{id}  (T07, 로그인 필요는 T18)
보낸 필드만 수정하고, 보내지 않은 필드는 그대로 둔다.

```json
{ "status": "DOING", "due_date": null }
```

- 수정 가능 필드: title, description, status, priority, due_date, archived
- `due_date`에 null을 보내면 마감일을 지운다. title·description·status·priority·archived에 null을 보내면 422.
- `archived: true`로 보관, `archived: false`로 TODO 복원. status를 DONE으로 바꿔도 archived는 자동으로 바뀌지 않는다(F14, T18 이후 변경).
- 응답 200: 수정된 `Task`. 없는 id이거나 다른 사용자의 할 일이면 404(존재 여부를 알려주지 않는다), 검증 실패는 422, 로그인하지 않았으면 401.

### DELETE /api/tasks/{id}  (T07, 로그인 필요는 T18)
할 일을 삭제한다. 삭제 확인은 화면에서 처리한다.
- 응답 204(본문 없음). 없는 id이거나 다른 사용자의 할 일이면 404, 로그인하지 않았으면 401.

## 할 일 소유자(T18)
- 모든 `/api/tasks` 엔드포인트는 로그인(세션 쿠키)이 필요하다. 없으면 401.
- 할 일은 등록한 사용자만 조회·수정·삭제할 수 있다. 다른 사용자의 id는 404로 응답해 존재 자체를 알려주지 않는다.
- 사용자 기능 도입 이전에 저장된 할 일은 `backend/add_task_owner.py`가 첫 회원가입 계정으로 귀속시켰다(자동 이전은 하지 않고, 이 한 번만 수동 실행).

## 화면 제공
- 개발 단계에서는 FastAPI가 `frontend/` 파일도 같은 주소(`/`)에서 제공한다. 화면은 `/api` 상대 경로로 API를 호출하므로 CORS 설정이 필요 없다.
- `/api`로 시작하는 경로가 화면 파일보다 먼저 처리된다.
- 서버 분리 단계(T14)에서는 Nginx가 화면 파일을 제공하고 `/api`를 App 서버로 전달한다.

## 저장 단계
- T06~T07: 서버 메모리에 저장한다. API를 재시작하면 데이터가 사라진다.
- T11부터: MariaDB에 저장하며 재시작 후에도 유지된다. API 계약은 바꾸지 않는다.
- `/api/health`는 API 프로세스 상태만 확인하며 DB 접속 여부는 확인하지 않는다.
- 단계 간 데이터는 자동 이전하지 않는다.

# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: 두 항목 등록, 빈 제목 거절. 이 단계에서 새로고침하면 사라져도 정상이다.
  기록(2026-10-13): frontend/index.html, styles.css, app.js 생성.
  Node DOM 스텁 테스트 통과(두 항목 등록, 빈·공백 제목 거절, 101자 거절, 100자 등록, HTML 글자 표시).
  http.server 5500에서 세 파일 200 응답.
  Windows 브라우저(http://localhost:5500, WSL localhostForwarding)에서 사용자 확인 정상. 남은 오류 없음.
- [x] T02: localStorage(task-flow-v1) 저장·복원.
  확인: 새로고침 후 유지. 손상된 저장값을 자동 덮어쓰지 않는다.
  기록(2026-10-13): frontend/app.js 저장·복원 추가, index.html에 저장 오류 영역·버튼 id 추가, styles.css 비활성 스타일.
  Node 스텁 테스트 통과(저장, 재실행 후 복원, 손상값 4종에서 등록 중지·원래 값 유지, 저장 실패 시 되돌림, T01 회귀).
  http.server 세 파일 200 응답.
  Windows 브라우저에서 사용자 확인 정상(새로고침 후 유지, 손상값 입력 시 등록 중지). 남은 오류 없음.
- [x] T03: 상태 변경, 수정, 삭제 확인.
  확인: 삭제 취소 시 유지. 다른 항목이 수정되지 않는다.
  기록(2026-10-13): frontend/app.js 상태 선택·제목 수정·삭제 확인 추가(id 기준), styles.css 항목 버튼·완료 스타일.
  설명 수정은 T04에서 다룬다. 저장 실패 시 변경을 되돌린다. status 없는 기존 저장값은 TODO로 읽는다.
  Node 스텁 테스트 12개 통과(상태 변경, 빈 제목 수정 거절, 수정·취소·Esc, 삭제 취소 유지, 삭제 시 해당 항목만, 재실행 후 유지, 저장 실패 되돌림, 회귀).
  Windows 브라우저에서 사용자 확인 정상(상태 변경·수정·삭제 취소·삭제, 새로고침 후 유지). 남은 오류 없음.
- [x] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: 필터 중 수정·삭제, 어제 마감 TODO의 지연 표시.
  기록(2026-10-13): index.html 등록 폼(우선순위·마감일·설명)과 검색·필터 영역 추가, app.js 필드·검증·수정 폼·필터·지연 표시, styles.css 배지·필터 스타일.
  수정 폼에서 제목·설명·우선순위·마감일을 함께 수정한다. 이전 단계 저장값은 빠진 필드를 기본값으로 읽는다.
  Node 스텁 테스트 통과: T04 12개(기본값, 검증, 지연 표시, 검색·필터 AND, 필터 중 수정·삭제, 호환·손상값, 새로고침 유지), T03 회귀 12개.
  Windows 브라우저에서 사용자 확인 정상(어제 마감 TODO 지연 표시, 필터 AND, 필터 중 수정·삭제, 새로고침 유지). 남은 오류 없음.
## 3장: API
- [x] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: curl로 200과 status=ok.
  기록(2026-10-13): API-SPEC.md(T05~T08 계약), backend/__init__.py, backend/main.py, requirements.txt(fastapi 0.143.0, uvicorn 0.54.0), .gitignore 생성.
  실행: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 (Python 3.10.12)
  결과: curl -i /api/health → 200, {"status":"ok"}. /docs 200, 없는 경로 404. 남은 오류 없음.
- [x] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
  기록(2026-10-13): backend/schemas.py(TaskCreate·Task 검증), backend/store.py(메모리 저장소), backend/main.py에 GET·POST /api/tasks 추가.
  수정: due_date strict 검증이 "2026-10-20"까지 거절해 YYYY-MM-DD 형식 검사 후 날짜 변환하도록 변경.
  실행: 포트 8001에서 uvicorn 실행 후 urllib 스크립트로 확인. 26개 통과(기본값 201, 경계값 201, 위반 18종 422, GET id 순서, 재시작 후 빈 목록).
  /docs 화면에서 사용자 확인 정상(등록 201, 빈 제목 422, 등록 후 조회). 남은 오류 없음.
- [x] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
  기록(2026-10-13): backend/schemas.py TaskUpdate(보낸 필드만 수정, due_date만 null 허용), backend/store.py update·delete·필터, backend/main.py PATCH·DELETE와 q·status·priority 쿼리.
  실행: 포트 8001에서 uvicorn 실행 후 urllib 스크립트로 확인. T07 41개 통과(부분 수정 시 나머지·다른 항목 유지, due_date null 삭제, PATCH 위반 14종 422, 없는 id 404, 삭제 204·재삭제 404, q·status·priority AND, 잘못된 필터 422). T06 회귀 25개 통과.
  남은 오류 없음.
- [x] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
  기록(2026-10-13): frontend/app.js localStorage 제거, 목록·등록·상태 변경·수정·삭제를 /api 호출로 교체, 검색·필터는 API 쿼리(q·status·priority)로 조회, 지연 표시는 화면에서 계산.
  backend/main.py에 frontend 정적 파일 제공 추가(같은 주소, CORS 불필요), index.html 오류 영역 id를 api-error로 변경, API-SPEC.md에 화면 제공 방식 추가.
  실행: 포트 8001 uvicorn + Node 스텁(실제 HTTP 요청) 테스트 12개 통과(등록 후 화면·curl 목록 동일, 필터 중 수정·삭제, 404 안내, API 중지 시 오류 표시). T07 API 회귀 41개 통과.
  Windows 브라우저(http://localhost:8000)에서 사용자 확인 정상(화면·curl 목록 동일, API 중지 시 오류 표시). 남은 오류 없음.
## 4장: DB
- [x] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
  기록(2026-10-13): MariaDB 10.6.23(127.0.0.1:3306). 사용자가 task_flow DB와 task_flow_app@localhost 생성, .env 작성. .env.example(가짜 값) 추가, .env 권한 600, .gitignore 대상 확인.
  결과: .env 정보로 mariadb 접속 성공(CURRENT_USER task_flow_app@localhost, DATABASE task_flow, utf8mb4_general_ci, 테이블 없음).
  참고: 권한이 ALL PRIVILEGES(DROP 포함)로 부여됨. 비밀번호가 짧아 서버 분리(T12) 전 변경 권장.
- [x] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
  기록(2026-10-13): requirements.txt에 SQLAlchemy 2.0.54, PyMySQL 1.2.3 추가. database.py(.env·환경변수 읽기, 엔진·세션), models.py(TaskRow), init_db.py(없는 테이블만 생성) 작성.
  실행: python -m backend.init_db 2회 → 1회차 생성, 2회차 "이미 있어 변경하지 않음".
  결과: DESCRIBE tasks로 id(AUTO_INCREMENT PK)·title varchar(100)·description varchar(2000)·status·priority ENUM·due_date date NULL·created_at datetime 확인. InnoDB, utf8mb4, 0행. 접속 정보 누락 시 안내 오류 확인. 남은 오류 없음.
- [x] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
  기록(2026-10-13): backend/store.py를 DbTaskStore(MariaDB, 메서드 동일)로 교체, backend/main.py가 DbTaskStore 사용·DB 오류 시 503 응답. API-SPEC.md에 503 추가.
  실행: 포트 8001 uvicorn + urllib 스크립트. 31개 통과(등록·부분 수정·422·404·204, q·status·priority AND, q의 %·_ 글자 검색, 2000자 설명·이모지 저장).
  결과: 등록 행을 mariadb SELECT로 확인. API 재시작 후 같은 id·수정 내용 유지. 틀린 DB 비밀번호로 실행 시 /api/tasks 503, 로그에 비밀번호 미노출.
  테스트 항목([T11검증] 제목)은 확인 후 삭제해 tasks는 0행. AUTO_INCREMENT는 6부터 시작. 남은 오류 없음.
## 5장: 서버 분리
- [x] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
  기록(2026-10-14): DB 서버 구성은 T09에서 완료(전용 DB·사용자). App 서버(backend/database.py의 engine)에서 SELECT 1 실행.
  실행: .venv/bin/python -c "..." (sqlalchemy text('SELECT 1')).
  결과: SELECT 1 → 1. 남은 오류 없음.
  참고: 같은 WSL 환경 내 시뮬레이션이며 .env의 DB_HOST는 127.0.0.1(실제 분리된 네트워크 호스트 아님).
- [x] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
  기록(2026-10-14): deploy/flow-task-app.service 생성(기존 backend 코드·.venv·.env를 그대로 사용, EnvironmentFile로 .env 전달, uvicorn backend.main:app --host 127.0.0.1 --port 8000).
  사용자가 sudo cp/daemon-reload/enable --now 직접 실행(이 세션은 sudo 비밀번호 입력 불가).
  결과: systemctl status flow-task-app → active (running), enabled. curl /api/health → 200 {"status":"ok"}. curl /api/tasks → 200(DB 연결 포함 정상). 남은 오류 없음.
  참고: 이번 단계는 같은 WSL 환경 내 시뮬레이션이며 실제 물리적으로 분리된 서버는 아니다.
  기록(2026-10-14) 추가: 서비스 파일명을 deploy/task-flow-api.service로 변경(요청 반영). flow-task-app.service는 비활성화·삭제, task-flow-api.service로 재등록.
  결과: systemctl status task-flow-api → active (running), enabled. flow-task-app 유닛 조회 시 "could not be found"로 정리 확인. curl /api/health → 200, curl /api/tasks → 200. 남은 오류 없음.
- [x] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
  기록(2026-10-14): deploy/task-flow-web.nginx.conf 생성(root /var/www/task-flow-web, location /api/는 127.0.0.1:8000으로 proxy_pass).
  nginx가 홈 디렉터리(750 권한)에 접근 못 해 frontend 3개 파일을 /var/www/task-flow-web로 복사(www-data 소유)해 서빙. 기존 default 사이트 비활성화 후 task-flow-web 사이트 등록, 사용자가 sudo로 직접 실행.
  backend/main.py 수정: app.mount("/", StaticFiles...) 제거, 미사용 Path·StaticFiles import 제거. API 서버(8000)가 /api/*만 담당하도록 역할 분리(요청 반영). API 계약(엔드포인트) 변경 없음.
  실행: curl로 8000(API 전용, 루트 404)·80(Nginx, 프런트 200·/api 프록시 200) 확인.
  결과: Web 주소(POST /api/tasks)로 등록 → mariadb SELECT로 DB 저장 확인(id 9) → sudo systemctl restart task-flow-api → Web 주소 GET /api/tasks에서 동일 항목 유지 확인. 확인 후 테스트 항목 삭제, 기존 사용자 데이터(id 3,4,5) 영향 없음. 남은 오류 없음.
## 6장: 사용자 인증
- [x] T15: users 테이블 설계·생성. backend/models.py에 UserRow(id, email unique, password_hash, created_at) 추가, init_db.py가 users도 생성하도록 확장.
  확인: DESCRIBE users로 컬럼·unique 제약 확인. 기존 tasks 테이블과 데이터는 그대로 유지되는지 확인.
  기록(2026-10-14): backend/models.py에 UserRow(id PK, email unique varchar(255), password_hash varchar(255), created_at) 추가.
  init_db.py를 tasks·users 둘 다 테이블별로 존재 여부 확인 후 없는 것만 생성하도록 확장(기존 "없는 테이블만 생성" 동작 유지).
  실행: python -m backend.init_db → "tasks 테이블이 이미 있어 변경하지 않았습니다." / "users 테이블을 만들었습니다."
  결과: DESCRIBE users로 컬럼 4개 확인, SHOW INDEX FROM users로 email UNIQUE 인덱스 확인. tasks 기존 데이터(id 3,4,5) 그대로 유지. 남은 오류 없음.
- [x] T16: 회원가입 API. POST /api/auth/signup(email, password). bcrypt로 해시 저장.
  확인: 정상 가입 201, 중복 이메일 422, 8자 미만 비밀번호 422, 저장된 값이 평문이 아닌 해시인지 DB에서 확인.
  기록(2026-10-14): requirements.txt에 bcrypt==5.0.0 추가(비밀번호 해시용). backend/schemas.py에 UserCreate(email 형식 검증, password 8자 이상)·User 응답 모델 추가.
  backend/security.py(신규) bcrypt 해시·검증 함수, backend/users.py(신규) DbUserStore(이메일 중복 시 EmailAlreadyRegistered), backend/main.py에 POST /api/auth/signup(email 중복 422, 그 외 검증 실패는 pydantic 422) 추가.
  실행: 임시 포트(8001)에서 curl로 확인 후 테스트 데이터 삭제, sudo systemctl restart task-flow-api로 운영 서비스 반영.
  결과: 정상 가입 201, 중복 이메일 422, 8자 미만 비밀번호 422, 이메일 형식 오류 422, 정의되지 않은 필드 422. DB password_hash가 "$2b$12$..." 형태(평문 아님) 확인. 기존 tasks·users API 영향 없음. 남은 오류 없음.
  추가(프런트엔드 일부 반영, 원래 T19 범위 중 회원가입 화면만 선반영): frontend/index.html에 회원가입 폼 섹션, frontend/styles.css에 .form-success·.auth-section, frontend/app.js에 이메일·비밀번호 검증과 /api/auth/signup 호출 추가.
  로그인 화면은 아직 없음(T17 로그인 API 이후 T19에서 추가). Web 주소(80, Nginx 경유)로 가입 201, 중복 422 확인 후 테스트 데이터 삭제.
  정정(2026-10-14, 사용자 요청): 식별자를 이메일에서 아이디(username, 영문 소문자·숫자·_, 4~20자)로 변경. PRD.md F10·F11·데이터·완료 기준 수정.
  users 테이블은 이 시점까지 0행이어서 DROP TABLE 후 backend.init_db로 재생성(email unique → username(20) unique). backend/models.py·schemas.py·users.py(EmailAlreadyRegistered→UsernameAlreadyRegistered)·main.py, frontend 3개 파일 모두 email→username으로 수정.
  재검증: 임시 포트(8001)와 Web 주소(80) 양쪽에서 가입 201·중복 아이디 422·형식 오류(대문자·3자 이하) 422 확인 후 테스트 데이터 삭제. API-SPEC.md에 User 객체·POST /api/auth/signup 문서화.
- [x] T17: 로그인·로그아웃 API. POST /api/auth/login(세션 쿠키 발급), POST /api/auth/logout(세션 종료). 미인증 요청은 401.
  확인: 정상 로그인 후 쿠키 발급, 잘못된 비밀번호 401, 로그아웃 후 보호된 API 재요청 시 401.
  기록(2026-10-14): requirements.txt에 itsdangerous==2.2.0 추가(세션 쿠키 서명, Starlette SessionMiddleware 의존성). .env·.env.example에 SESSION_SECRET_KEY 추가(.env 값은 무작위 생성, 비공개로 추가).
  backend/main.py에 SessionMiddleware 등록(쿠키명 task_flow_session, HttpOnly, same_site=lax, https_only=False(현재 Nginx가 http만 제공), max_age 24시간), load_session_secret()로 SESSION_SECRET_KEY 필수화.
  backend/users.py에 authenticate(username, password)·get(user_id) 추가. backend/schemas.py에 UserLogin 추가. POST /api/auth/login(실패 시 401, 메시지는 아이디·비밀번호 구분 없이 동일)과 POST /api/auth/logout(세션 없으면 401, 있으면 204+세션 clear) 추가.
  실행: 임시 포트(8001)와 Web 주소(80) 양쪽에서 curl+쿠키 저장소로 확인. 테스트 계정 삭제 후 sudo systemctl restart task-flow-api로 반영.
  결과: 정상 로그인 200+Set-Cookie 확인, 잘못된 비밀번호·존재하지 않는 아이디 401(메시지 동일), 정의되지 않은 필드·필드 누락 422. 로그아웃 204, 세션 쿠키 갱신 후 재로그아웃 401, 쿠키 없이 로그아웃 401. API-SPEC.md에 두 엔드포인트 문서화. 남은 오류 없음.
  추가(2026-10-14, 사용자 요청 — 프런트엔드 전면 반영, 방침 변경): "백엔드 기능 구현 시 대응 프런트엔드도 같은 작업에서 함께 구현"으로 AGENTS.md 구현 범위에 규칙 추가.
  frontend/signup.html·signup.js(신규)로 회원가입을 별도 페이지로 분리. frontend/api.js(신규)에 API_BASE·ApiError·errorMessage·request 공통 로직 추출(app.js·signup.js가 공유).
  index.html 상단을 로그인 영역(아이디·비밀번호·로그인 버튼, 그 아래 회원가입 페이지 이동 버튼)으로 교체, 로그인 성공 시 계정 정보·로그아웃 버튼으로 전환. app.js에 로그인/로그아웃 핸들러 추가, styles.css에 .btn·.signup-link-row 추가.
  실행: node --check로 3개 JS 파일 문법 확인 후 /var/www/task-flow-web에 배포. Web 주소(80)에서 signup.html 가입 → index.html 로그인(쿠키 발급) → 로그아웃(204) 전체 플로우 curl로 확인, 테스트 계정 삭제.
  참고: 할 일 목록 화면은 아직 로그인 여부와 무관하게 항상 보임(T18에서 로그인 필요하도록 연결 예정). 남은 오류 없음.
- [x] T18: tasks에 user_id 연결. tasks 테이블에 user_id 컬럼 추가(기존 행은 첫 회원가입 계정으로 귀속), 기존 할 일 API(GET·POST·PATCH·DELETE)에 로그인 필요·소유자 필터링 적용.
  프런트엔드도 함께 반영(로그인 화면과 로그아웃 버튼은 T16·T17에서 선반영 완료): 로그인 상태에 따라 할 일 등록 폼·목록을 보이거나 숨긴다. 로그인 없이 /api/tasks 호출 시 401을 화면에서 안내로 보여준다.
  확인: 로그인 없이 /api/tasks 요청 시 401. 다른 사용자 id로 만든 할 일은 보이지도 수정되지도 않는다. 기존 tasks 3건이 삭제되지 않고 귀속 계정 소유로 남아있는지 확인. 화면에서 로그아웃 상태→할 일 화면 숨김, 로그인 후 등장까지 확인.
  기록(2026-10-14): backend/models.py에 TaskRow.user_id(ForeignKey users.id, NOT NULL) 추가. backend/add_task_owner.py(신규, 멱등) 작성·실행: 컬럼 추가 → 기존 tasks 3건을 첫 회원가입 계정(admin, id=5)으로 귀속 → NOT NULL·외래 키 제약 적용.
  backend/store.py의 list·create·update·delete에 user_id 매개변수 추가(다른 사용자 소유 id는 404로 응답, 존재 여부를 알려주지 않음). backend/main.py에 require_user 의존성(세션에 user_id 없으면 401) 추가, 4개 엔드포인트에 적용. API-SPEC.md에 401·소유자 분리 규칙 문서화.
  실행: 임시 포트(8001)에서 userA·userB 테스트 계정으로 격리 확인 후 삭제. sudo systemctl restart task-flow-api로 반영.
  결과: 로그인 없이 401, userB가 userA의 할 일 조회·수정·삭제 시도 시 404, userA 목록은 유지. admin의 기존 데이터는 영향 없음(단, 사용자가 실제 브라우저에서 직접 삭제해 현재 0건 — 제가 변경한 것 아님, 확인 완료). 남은 오류 없음.
  프런트엔드(사용자 요청으로 여러 차례 반복 조정): index.html에 tasks-area/인증 상태 분기 추가 → 로그인 전용 풀페이지 카드(auth-page/auth-card, 탭형 로그인·회원가입 전환, 라벨+비밀번호 눈 아이콘, 로그인/회원가입 버튼)로 재구성 → 로그인 후 우측 상단에 아이디·로그아웃 표시 → 전체 색상을 온색(주황·테라코타) 계열로 변경(styles.css CSS 변수화) → 회원가입 성공 시 안내 문구 없이 index.html로 자동 이동.
  frontend/api.js(신규)에 공통 request/ApiError와 setupPasswordToggle 유틸 추출, signup.html·signup.js도 같은 카드 디자인 적용.
  실행: node --check로 매 변경마다 JS 문법 확인 후 /var/www/task-flow-web 배포. 남은 오류 없음.
## 7장: 다이어리 컨셉 개편
- [ ] T20: 로그인·회원가입 화면을 다이어리 표지 느낌으로 재디자인. 화면 중앙에 로그인/회원가입 카드를 유지하되 표지 분위기(질감·색상·타이포)를 반영한다.
  확인: 로그인·회원가입 화면에서 다이어리 표지 느낌을 실제로 확인(주관적 디자인이라 Windows 브라우저로 사용자가 확인).
- [ ] T21: 할 일 화면을 다이어리가 펼쳐진 레이아웃으로 재구성. 좌측에 TODO·ARCHIVE 인덱스 탭을 추가해 클릭 시 화면을 전환한다. 우측 상단 아이디·로그아웃은 유지한다.
  확인: TODO·ARCHIVE 탭 클릭 시 해당 화면으로 전환. 기존 등록·수정·삭제·완료 기능은 TODO 화면에서 그대로 동작.
- [ ] T22: ARCHIVE 분류 로직 적용. DONE 상태이거나 마감일이 지난(F09 기준) 항목은 TODO 화면에서 숨기고 ARCHIVE 화면에서만 보여준다. API 변경은 없고 화면에서 기존 목록을 분류한다.
  확인: 항목을 완료 처리하면 TODO에서 사라지고 ARCHIVE에 나타남. 마감일이 지난 미완료 항목도 ARCHIVE에 나타남. 사용자별 분리(T18)는 그대로 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
T12~T22: T13에서 등록한 systemd 서비스(task-flow-api) 사용. 코드 변경 후 sudo systemctl restart task-flow-api로 반영 확인.
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 새 의존성
bcrypt==5.0.0(T16 적용): 비밀번호 해시 저장용. itsdangerous==2.2.0(T17 적용): FastAPI(Starlette) 세션 쿠키 서명용. requirements.txt에 기록 완료.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.
"use strict";

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const SEARCH_DELAY_MS = 300;
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const PRIORITIES = [
  { value: "HIGH", label: "높음" },
  { value: "NORMAL", label: "보통" },
  { value: "LOW", label: "낮음" },
];
const DEFAULT_PRIORITY = "NORMAL";

// 마지막으로 API에서 받은 목록(검색·필터 적용 결과).
let tasks = [];
let loadFailed = false;
// 로그인 폼으로 방금 로그인했을 때만 아이디를 안다. 새로고침 후 세션만 유효한 경우는 모른다.
let currentUsername = null;
// 늦게 도착한 이전 목록 응답이 최신 결과를 덮어쓰지 않도록 요청 번호를 비교한다.
let listRequestId = 0;
let searchTimer = null;
// 수정 중인 항목의 id. 한 번에 하나만 수정한다.
let editingId = null;
let editError = "";
// 수정을 시작하거나 수정 오류가 났을 때만 수정 입력칸으로 포커스를 옮긴다.
let focusEditForm = false;
// 제목 검색, 우선순위 필터. 빈 값은 조건 없음이며 API에서 AND로 적용한다.
const filters = { query: "", priority: "" };
// 좌측 인덱스에서 고른 화면. "todo"는 미완료·기한 전, "archive"는 완료했거나 기한이 지난 항목.
let currentView = "todo";

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const priorityInput = document.getElementById("task-priority");
const dueInput = document.getElementById("task-due");
const submitButton = document.getElementById("submit-button");
const formError = document.getElementById("form-error");
const apiError = document.getElementById("api-error");
const searchInput = document.getElementById("search-input");
const priorityFilter = document.getElementById("filter-priority");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");
const viewTitle = document.getElementById("view-title");
const navTodoButton = document.getElementById("nav-todo");
const navArchiveButton = document.getElementById("nav-archive");
const pageHeading = document.getElementById("page-heading");
const DEFAULT_PAGE_TITLE = "Task Flow";
const tasksArea = document.getElementById("tasks-area");
const authPage = document.getElementById("auth-page");
const appPage = document.getElementById("app-page");
const loginForm = document.getElementById("login-form");
const loginUsernameInput = document.getElementById("login-username");
const loginPasswordInput = document.getElementById("login-password");
const loginPasswordToggle = document.getElementById("login-password-toggle");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");
const accountInfo = document.getElementById("account-info");
const logoutButton = document.getElementById("logout-button");

setupPasswordToggle(loginPasswordInput, loginPasswordToggle);

function textLength(value) {
  return Array.from(value).length;
}

// 검증 실패 시 오류 메시지, 통과 시 null을 반환한다. 서버도 같은 규칙으로 다시 검증한다.
function validateTitle(title) {
  const length = textLength(title);
  if (length === 0) {
    return "제목을 입력하세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return null;
}

function validateDescription(description) {
  const length = textLength(description);
  if (length > DESCRIPTION_MAX_LENGTH) {
    return `설명은 ${DESCRIPTION_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return null;
}

// YYYY-MM-DD 형식이면서 실제 존재하는 날짜인지 확인한다.
function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function validateTaskInput(input) {
  return (
    validateTitle(input.title) ||
    validateDescription(input.description) ||
    (isValidPriority(input.priority) ? null : "우선순위가 올바르지 않습니다.") ||
    (input.due_date !== null && !isValidDate(input.due_date)
      ? "마감일은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다."
      : null)
  );
}

// 입력값을 API 요청 형식으로 정리한다. 빈 마감일은 null이다.
function readTaskInput(title, description, priority, dueDate) {
  return {
    title: title.trim(),
    description,
    priority,
    due_date: dueDate === "" ? null : dueDate,
  };
}

function isValidPriority(priority) {
  return PRIORITIES.some((item) => item.value === priority);
}

function labelOf(list, value) {
  const found = list.find((item) => item.value === value);
  return found ? found.label : value;
}

function findTask(id) {
  return tasks.find((task) => task.id === id);
}

function hasFilters() {
  return filters.query.trim() !== "" || filters.priority !== "";
}

function listPath() {
  const params = new URLSearchParams();
  const query = filters.query.trim();
  if (query !== "") {
    params.set("q", query);
  }
  if (filters.priority !== "") {
    params.set("priority", filters.priority);
  }
  const queryString = params.toString();
  // TODO·ARCHIVE 구분은 archived 값으로 화면에서 분류한다(visibleTasks).
  return queryString === "" ? "/tasks" : `/tasks?${queryString}`;
}

// API에서 현재 검색·필터 조건의 목록을 다시 받아 화면을 그린다.
// 401(로그인 필요)은 일반 오류와 다르게 로그인 화면 전환으로 처리한다.
async function loadTasks() {
  const requestId = ++listRequestId;
  try {
    const data = await request("GET", listPath());
    if (requestId !== listRequestId) {
      return;
    }
    tasks = data;
    loadFailed = false;
    apiError.textContent = "";
    tasksArea.hidden = false;
    showAccountView();
  } catch (error) {
    if (requestId !== listRequestId) {
      return;
    }
    if (error.status === 401) {
      tasks = [];
      loadFailed = false;
      apiError.textContent = "";
      tasksArea.hidden = true;
      showLoginView();
    } else {
      loadFailed = true;
      apiError.textContent = `목록을 불러오지 못했습니다. ${error.message}`;
    }
  }
  render();
}

// 변경 요청을 보내고 결과와 관계없이 목록을 다시 받는다. 실패하면 오류를 표시한다.
async function runAction(action) {
  let message = "";
  try {
    await action();
  } catch (error) {
    message = error.message;
  }
  await loadTasks();
  if (message) {
    apiError.textContent = message;
  }
}

// 로컬 달력 기준 오늘 날짜(YYYY-MM-DD).
function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isOverdue(task, today) {
  return task.due_date !== null && task.status !== "DONE" && task.due_date < today;
}

// 사용자가 직접 보관 처리한 항목만 ARCHIVE로 분류한다(F14). 완료(DONE) 여부는 보관에 영향이 없다.
function visibleTasks() {
  return tasks.filter((task) => (currentView === "archive" ? task.archived : !task.archived));
}

function setArchived(id, archived) {
  return runAction(() => request("PATCH", `/tasks/${id}`, { archived }));
}

function changeStatus(id, status) {
  return runAction(() => request("PATCH", `/tasks/${id}`, { status }));
}

function startEdit(id) {
  editingId = id;
  editError = "";
  focusEditForm = true;
  render();
}

function cancelEdit() {
  editingId = null;
  editError = "";
  render();
}

function showEditError(message) {
  editError = message;
  focusEditForm = true;
  render();
}

async function saveEdit(id, input) {
  const error = validateTaskInput(input);
  if (error) {
    showEditError(error);
    return;
  }
  try {
    await request("PATCH", `/tasks/${id}`, input);
  } catch (requestError) {
    if (requestError.status === 404) {
      // 이미 삭제된 항목이면 수정 폼을 닫고 최신 목록을 보여 준다.
      editingId = null;
      editError = "";
      await loadTasks();
      apiError.textContent = requestError.message;
      return;
    }
    // 입력 오류나 연결 실패는 입력한 내용을 유지한 채 오류를 보여 준다.
    showEditError(requestError.message);
    return;
  }
  editingId = null;
  editError = "";
  await loadTasks();
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task) {
    return Promise.resolve();
  }
  if (!window.confirm(`"${task.title}" 할 일을 삭제할까요?`)) {
    return Promise.resolve();
  }
  if (editingId === id) {
    editingId = null;
    editError = "";
  }
  return runAction(() => request("DELETE", `/tasks/${id}`));
}

function createButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createSelect(options, value, ariaLabel) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", ariaLabel);
  for (const item of options) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
  select.value = value;
  return select;
}

function createStatusSelect(task) {
  const select = createSelect(STATUSES, task.status, "상태");
  select.addEventListener("change", () => changeStatus(task.id, select.value));
  return select;
}

function createEditForm(task) {
  const container = document.createElement("div");
  container.className = "task-edit";

  const titleField = document.createElement("input");
  titleField.type = "text";
  titleField.value = task.title;
  titleField.setAttribute("aria-label", "제목 수정");

  const descriptionField = document.createElement("textarea");
  descriptionField.rows = 3;
  descriptionField.value = task.description;
  descriptionField.setAttribute("aria-label", "설명 수정");
  descriptionField.placeholder = "설명 (최대 2000자)";

  const priorityField = createSelect(PRIORITIES, task.priority, "우선순위 수정");

  const dueField = document.createElement("input");
  dueField.type = "date";
  dueField.value = task.due_date === null ? "" : task.due_date;
  dueField.setAttribute("aria-label", "마감일 수정");

  const save = () =>
    saveEdit(
      task.id,
      readTaskInput(titleField.value, descriptionField.value, priorityField.value, dueField.value)
    );

  titleField.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      save();
    }
  });
  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cancelEdit();
    }
  });

  const options = document.createElement("div");
  options.className = "form-row";
  options.appendChild(priorityField);
  options.appendChild(dueField);
  options.appendChild(createButton("저장", save));
  options.appendChild(createButton("취소", cancelEdit));

  container.appendChild(titleField);
  container.appendChild(descriptionField);
  container.appendChild(options);
  return { container, focusTarget: titleField };
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function createTaskItem(task, today) {
  const item = document.createElement("li");
  item.dataset.id = String(task.id);
  const classes = [];
  if (task.status === "DONE") {
    classes.push("done");
  }
  if (isOverdue(task, today)) {
    classes.push("overdue");
  }
  item.className = classes.join(" ");

  if (task.id === editingId) {
    const { container, focusTarget } = createEditForm(task);
    item.appendChild(container);
    if (editError) {
      const error = document.createElement("p");
      error.className = "form-error";
      error.textContent = editError;
      item.appendChild(error);
    }
    return { item, focusTarget };
  }

  const main = document.createElement("div");
  main.className = "task-main";

  const info = document.createElement("div");
  info.className = "task-info";

  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.appendChild(
    createBadge(labelOf(PRIORITIES, task.priority), `priority-${task.priority.toLowerCase()}`)
  );
  if (task.due_date !== null) {
    meta.appendChild(createBadge(`마감 ${task.due_date}`, "due"));
  }
  if (isOverdue(task, today)) {
    meta.appendChild(createBadge("지연", "overdue-badge"));
  }

  info.appendChild(title);
  info.appendChild(meta);
  if (task.description !== "") {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    info.appendChild(description);
  }

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.appendChild(createStatusSelect(task));
  actions.appendChild(createButton("수정", () => startEdit(task.id)));
  actions.appendChild(
    task.archived
      ? createButton("복원", () => setArchived(task.id, false))
      : createButton("보관", () => setArchived(task.id, true))
  );
  actions.appendChild(createButton("삭제", () => deleteTask(task.id)));

  main.appendChild(info);
  main.appendChild(actions);
  item.appendChild(main);
  return { item, focusTarget: null };
}

function render() {
  taskList.replaceChildren();
  const today = todayString();
  const shown = visibleTasks();
  let focusTarget = null;

  for (const task of shown) {
    const created = createTaskItem(task, today);
    taskList.appendChild(created.item);
    if (created.focusTarget) {
      focusTarget = created.focusTarget;
    }
  }

  taskCount.textContent = hasFilters() ? `(검색 결과 ${shown.length})` : `(${shown.length})`;
  emptyMessage.hidden = shown.length > 0;
  if (loadFailed && shown.length === 0) {
    emptyMessage.textContent = "목록을 불러오지 못했습니다.";
  } else if (hasFilters()) {
    emptyMessage.textContent = "조건에 맞는 할 일이 없습니다.";
  } else {
    emptyMessage.textContent =
      currentView === "archive" ? "보관된 항목이 없습니다." : "등록된 할 일이 없습니다.";
  }
  if (focusTarget && focusEditForm) {
    focusTarget.focus();
  }
  focusEditForm = false;
}

function setView(view) {
  currentView = view;
  viewTitle.textContent = view === "archive" ? "ARCHIVE" : "TODO";
  navTodoButton.classList.toggle("active", view === "todo");
  navArchiveButton.classList.toggle("active", view === "archive");
  // 새 항목은 항상 TODO로 시작하므로(F03) 등록 폼은 TODO 화면에서만 보여준다.
  form.hidden = view === "archive";
  formError.hidden = view === "archive";
  if (editingId !== null) {
    editingId = null;
    editError = "";
  }
  render();
}

navTodoButton.addEventListener("click", () => setView("todo"));
navArchiveButton.addEventListener("click", () => setView("archive"));

function resetForm() {
  titleInput.value = "";
  descriptionInput.value = "";
  priorityInput.value = DEFAULT_PRIORITY;
  dueInput.value = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitButton.disabled) {
    return;
  }

  const input = readTaskInput(
    titleInput.value,
    descriptionInput.value,
    priorityInput.value,
    dueInput.value
  );
  const error = validateTaskInput(input);
  if (error) {
    formError.textContent = error;
    titleInput.focus();
    return;
  }

  // 응답을 기다리는 동안 같은 할 일이 두 번 등록되지 않도록 버튼을 잠근다.
  submitButton.disabled = true;
  try {
    await request("POST", "/tasks", input);
  } catch (requestError) {
    formError.textContent = `등록하지 못했습니다. ${requestError.message}`;
    return;
  } finally {
    submitButton.disabled = false;
  }

  formError.textContent = "";
  resetForm();
  titleInput.focus();
  await loadTasks();
});

function setPageTitle(username) {
  const title = username ? `${username}'s Task Flow` : DEFAULT_PAGE_TITLE;
  pageHeading.textContent = title;
  document.title = title;
}

// 방금 로그인 폼으로 로그인했으면 아이디를 보여주고, 새로고침으로 세션만 확인된 경우는 일반 문구를 보여준다.
function showAccountView() {
  authPage.hidden = true;
  appPage.hidden = false;
  accountInfo.textContent = currentUsername ? `${currentUsername}님` : "로그인됨";
  setPageTitle(currentUsername);
}

function showLoginView() {
  currentUsername = null;
  authPage.hidden = false;
  appPage.hidden = true;
  loginForm.reset();
  setPageTitle(null);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginButton.disabled) {
    return;
  }

  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;
  if (username === "" || password === "") {
    loginError.textContent = "아이디와 비밀번호를 입력하세요.";
    return;
  }

  loginButton.disabled = true;
  try {
    const user = await request("POST", "/auth/login", { username, password });
    loginError.textContent = "";
    currentUsername = user.username;
    await loadTasks();
  } catch (requestError) {
    loginError.textContent = requestError.message;
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  if (logoutButton.disabled) {
    return;
  }
  logoutButton.disabled = true;
  try {
    await request("POST", "/auth/logout");
    showLoginView();
    tasks = [];
    tasksArea.hidden = true;
    render();
  } catch (requestError) {
    apiError.textContent = requestError.message;
  } finally {
    logoutButton.disabled = false;
  }
});

searchInput.addEventListener("input", () => {
  filters.query = searchInput.value;
  // 글자를 입력할 때마다 요청하지 않도록 입력이 멈춘 뒤 조회한다.
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadTasks, SEARCH_DELAY_MS);
});
priorityFilter.addEventListener("change", () => {
  filters.priority = priorityFilter.value;
  loadTasks();
});

loadTasks();

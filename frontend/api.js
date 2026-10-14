"use strict";

const API_BASE = "/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// FastAPI 오류 응답({"detail": ...})을 화면에 보여 줄 문장으로 바꾼다.
function errorMessage(body, status) {
  if (body && Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((item) => String(item.msg).replace(/^Value error, /, "")).join(" ");
  }
  if (body && typeof body.detail === "string") {
    return body.detail;
  }
  return `요청을 처리하지 못했습니다. (HTTP ${status})`;
}

async function request(method, path, body) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await window.fetch(`${API_BASE}${path}`, options);
  } catch (networkError) {
    throw new ApiError("API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.", 0);
  }

  if (response.status === 204) {
    return null;
  }
  let data = null;
  try {
    data = await response.json();
  } catch (parseError) {
    data = null;
  }
  if (!response.ok) {
    throw new ApiError(errorMessage(data, response.status), response.status);
  }
  return data;
}

const EYE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.4 ' +
  '10.4 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24"/>' +
  '<line x1="1" y1="1" x2="23" y2="23"/></svg>';

// 비밀번호 입력칸 옆의 눈 모양 버튼으로 평문 표시를 켜고 끈다.
function setupPasswordToggle(input, button) {
  button.innerHTML = EYE_ICON;
  button.setAttribute("aria-label", "비밀번호 표시");
  button.addEventListener("click", () => {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
    button.setAttribute("aria-label", showing ? "비밀번호 표시" : "비밀번호 숨기기");
  });
}

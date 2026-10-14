"use strict";

const PASSWORD_MIN_LENGTH = 8;
const USERNAME_PATTERN = /^[a-z0-9_]{4,20}$/;

const signupForm = document.getElementById("signup-form");
const signupUsernameInput = document.getElementById("signup-username");
const signupPasswordInput = document.getElementById("signup-password");
const signupButton = document.getElementById("signup-button");
const signupError = document.getElementById("signup-error");
const signupPasswordToggle = document.getElementById("signup-password-toggle");

setupPasswordToggle(signupPasswordInput, signupPasswordToggle);

// 서버 검증 규칙(backend/schemas.py)과 같은 조건을 화면에서도 먼저 확인한다.
function validateUsername(username) {
  if (!USERNAME_PATTERN.test(username)) {
    return "아이디는 영문 소문자·숫자·밑줄(_)로 4~20자여야 합니다.";
  }
  return null;
}

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  return null;
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (signupButton.disabled) {
    return;
  }

  const username = signupUsernameInput.value.trim();
  const password = signupPasswordInput.value;
  const error = validateUsername(username) || validatePassword(password);
  if (error) {
    signupError.textContent = error;
    signupUsernameInput.focus();
    return;
  }

  signupButton.disabled = true;
  try {
    await request("POST", "/auth/signup", { username, password });
    window.location.href = "index.html";
  } catch (requestError) {
    signupError.textContent = requestError.message;
  } finally {
    signupButton.disabled = false;
  }
});

import express from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db/database.js";
import { requireAuth, signAuthToken } from "../middleware/auth.js";
import { ok, fail } from "../utils/response.js";

const router = express.Router();

const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 32;
const PASSWORD_HASH_ROUNDS = 10;

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at
  };
}

function validateUsername(username) {
  if (typeof username !== "string" || username.trim() === "") {
    return "请输入账号";
  }

  const safeUsername = username.trim();

  if (
    safeUsername.length < USERNAME_MIN_LENGTH ||
    safeUsername.length > USERNAME_MAX_LENGTH
  ) {
    return "账号长度需为 3-24 位";
  }

  if (!USERNAME_PATTERN.test(safeUsername)) {
    return "账号只能包含字母、数字、下划线或短横线";
  }

  return "";
}

function validatePassword(password) {
  if (typeof password !== "string" || password === "") {
    return "请输入密码";
  }

  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return "密码长度需为 6-32 位";
  }

  return "";
}

router.post("/register", async (req, res) => {
  try {
    const db = getDb();
    const { username, password } = req.body ?? {};
    const safeUsername = typeof username === "string" ? username.trim() : "";

    const usernameError = validateUsername(username);

    if (usernameError) {
      return fail(res, 400, "USERNAME_INVALID", usernameError);
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return fail(res, 400, "PASSWORD_INVALID", passwordError);
    }

    const existingUser = db
      .prepare(
        `
        SELECT id
        FROM users
        WHERE username = ?
        `
      )
      .get(safeUsername);

    if (existingUser) {
      return fail(res, 409, "USERNAME_EXISTS", "账号已存在，请换一个账号");
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
    const result = db
      .prepare(
        `
        INSERT INTO users
          (username, password_hash, last_login_at)
        VALUES
          (?, ?, datetime('now'))
        `
      )
      .run(safeUsername, passwordHash);

    const user = db
      .prepare(
        `
        SELECT
          id,
          username,
          created_at,
          updated_at,
          last_login_at
        FROM users
        WHERE id = ?
        `
      )
      .get(result.lastInsertRowid);

    return ok(res, {
      user: toPublicUser(user),
      token: signAuthToken(user)
    });
  } catch (error) {
    console.error("[POST /api/auth/register]", error);

    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return fail(res, 409, "USERNAME_EXISTS", "账号已存在，请换一个账号");
    }

    return fail(res, 500, "AUTH_ERROR", "注册失败，请稍后再试");
  }
});

router.post("/login", async (req, res) => {
  try {
    const db = getDb();
    const { username, password } = req.body ?? {};
    const safeUsername = typeof username === "string" ? username.trim() : "";

    if (!safeUsername || typeof password !== "string" || password === "") {
      return fail(res, 401, "INVALID_CREDENTIALS", "账号或密码不正确");
    }

    const userWithPassword = db
      .prepare(
        `
        SELECT
          id,
          username,
          password_hash,
          created_at,
          updated_at,
          last_login_at
        FROM users
        WHERE username = ?
        `
      )
      .get(safeUsername);

    if (!userWithPassword) {
      return fail(res, 401, "INVALID_CREDENTIALS", "账号或密码不正确");
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      userWithPassword.password_hash
    );

    if (!isPasswordValid) {
      return fail(res, 401, "INVALID_CREDENTIALS", "账号或密码不正确");
    }

    db.prepare(
      `
      UPDATE users
      SET last_login_at = datetime('now')
      WHERE id = ?
      `
    ).run(userWithPassword.id);

    const user = db
      .prepare(
        `
        SELECT
          id,
          username,
          created_at,
          updated_at,
          last_login_at
        FROM users
        WHERE id = ?
        `
      )
      .get(userWithPassword.id);

    return ok(res, {
      user: toPublicUser(user),
      token: signAuthToken(user)
    });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return fail(res, 500, "AUTH_ERROR", "登录失败，请稍后再试");
  }
});

router.get("/me", requireAuth, (req, res) => {
  return ok(res, {
    user: req.user
  });
});

export default router;

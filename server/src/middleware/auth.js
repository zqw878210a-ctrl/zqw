import jwt from "jsonwebtoken";
import { getDb } from "../db/database.js";
import { fail } from "../utils/response.js";

const LOCAL_JWT_SECRET = "wardrobe-mvp-local-dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN?.trim() || "7d";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret) {
    return secret;
  }

  return LOCAL_JWT_SECRET;
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      username: user.username
    },
    getJwtSecret(),
    {
      subject: String(user.id),
      expiresIn: JWT_EXPIRES_IN
    }
  );
}

function getBearerToken(req) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return "";
  }

  return token.trim();
}

export function requireAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return fail(res, 401, "AUTH_REQUIRED", "请先登录");
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return fail(res, 401, "TOKEN_INVALID", "登录状态无效，请重新登录");
    }

    const user = getDb()
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
      .get(userId);

    if (!user) {
      return fail(res, 401, "TOKEN_INVALID", "登录状态无效，请重新登录");
    }

    req.user = {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at
    };

    return next();
  } catch (error) {
    return fail(res, 401, "TOKEN_INVALID", "登录状态无效，请重新登录");
  }
}

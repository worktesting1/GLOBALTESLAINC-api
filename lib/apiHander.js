import { NextResponse } from "next/server";
import { getUserIdFromToken, isAdmin } from "../middleware/verifyToken";

export const withAuth = (handler) => {
  return async (req, headers, ...args) => {
    const authHeader =
      req.headers.get("authorization") || req.headers.get("token");

    if (!authHeader) {
      return NextResponse.json(
        { error: "You are not authenticated" },
        { status: 401, headers }
      );
    }

    try {
      const userId = getUserIdFromToken({ headers: { token: authHeader } });
      if (!userId) {
        return NextResponse.json(
          { error: "Token is invalid" },
          { status: 403, headers }
        );
      }

      req.userId = userId;
      return handler(req, headers, ...args);
    } catch (error) {
      return NextResponse.json(
        { error: "Token is invalid" },
        { status: 403, headers }
      );
    }
  };
};

export const withAdmin = (handler) => {
  return async (req, headers, ...args) => {
    const authHeader =
      req.headers.get("authorization") || req.headers.get("token");

    if (!authHeader) {
      return NextResponse.json(
        { error: "You are not authenticated" },
        { status: 401, headers }
      );
    }

    try {
      const userId = getUserIdFromToken({ headers: { token: authHeader } });
      if (!userId) {
        return NextResponse.json(
          { error: "Token is invalid" },
          { status: 403, headers }
        );
      }

      const adminCheck = await isAdmin(userId);
      if (!adminCheck) {
        return NextResponse.json(
          { error: "You are not allowed to perform such action" },
          { status: 403, headers }
        );
      }

      req.userId = userId;
      return handler(req, headers, ...args);
    } catch (error) {
      return NextResponse.json(
        { error: "Authorization failed" },
        { status: 403, headers }
      );
    }
  };
};

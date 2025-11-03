import jwt from "jsonwebtoken";
import User from "../models/Users";
import Admin from "../models/Admin";

// Helper function to handle token verification
export const verifyToken = (handler) => {
  return async (req, res) => {
    const authHeader = req.headers.token || req.headers.authorization;

    if (authHeader) {
      try {
        const user = jwt.verify(authHeader, process.env.JWT_SEC);
        req.userId = user.id;
        return handler(req, res);
      } catch (err) {
        return res.status(403).json("Token is invalid");
      }
    } else {
      return res.status(401).json("You are not authenticated");
    }
  };
};

// Verify token and authorization
export const verifyTokenAuthorization = (handler) => {
  return async (req, res) => {
    const authHeader = req.headers.token || req.headers.authorization;

    if (authHeader) {
      try {
        const user = jwt.verify(authHeader, process.env.JWT_SEC);
        req.userId = user.id;

        // For authorization, we need to check if user has access
        // This will be handled in individual routes
        return handler(req, res);
      } catch (err) {
        return res.status(403).json("Token is invalid");
      }
    } else {
      return res.status(401).json("You are not authenticated");
    }
  };
};

// Verify if it's an admin
export const verifyTokenAdmin = (handler) => {
  return async (req, res) => {
    const authHeader = req.headers.token || req.headers.authorization;

    if (authHeader) {
      try {
        const userData = jwt.verify(authHeader, process.env.JWT_SEC);
        req.userId = userData.id;

        const admin = await Admin.findById(req.userId);
        if (admin?.isAdmin) {
          req.user = admin;
          return handler(req, res);
        } else {
          return res
            .status(403)
            .json("You are not allowed to perform such action");
        }
      } catch (err) {
        return res.status(403).json("Token is invalid");
      }
    } else {
      return res.status(401).json("You are not authenticated");
    }
  };
};

// Alternative approach: Direct verification functions
export const getUserIdFromToken = (req) => {
  const authHeader = req.headers.token || req.headers.authorization;
  if (!authHeader) return null;

  try {
    const user = jwt.verify(authHeader, process.env.JWT_SEC);
    return user.id;
  } catch (err) {
    return null;
  }
};

export const isAdmin = async (userId) => {
  try {
    const admin = await Admin.findById(userId);
    return admin?.isAdmin || false;
  } catch (err) {
    return false;
  }
};

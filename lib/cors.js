// lib/cors.js - Production-ready version
export function corsHeaders(request) {
  try {
    const origin = request?.headers?.get("origin") || "";

    // Environment-based origin configuration
    const getEnvironmentConfig = () => {
      // Use Vercel's environment variable or fallback to NODE_ENV
      const env =
        process.env.VERCEL_ENV || process.env.NODE_ENV || "development";

      const allowedOrigins = {
        development: [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "https://localhost:3000",
          "https://localhost:3001",
          "https://localhost:3002",
          "http://127.0.0.1:3000",
          "https://capitalflowfinance.com",
          "https://www.capitalflowfinance.com",
          "https://wealthwise.online",
          "https://www.wealthwise.online",
        ],
        preview: [
          // Vercel preview deployments
          "https://*.vercel.app",
          "https://capitalflowfinance.com",
          "https://www.capitalflowfinance.com",
          "https://wealthwise.online",
          "https://www.wealthwise.online",
        ],
        production: [
          "https://capitalflowfinance.com",
          "https://www.capitalflowfinance.com",
          "https://wealthwise.online",
          "https://www.wealthwise.online",
        ],
      };

      return {
        origins: allowedOrigins[env] || allowedOrigins.development,
        allowAllOrigins: env === "development",
      };
    };

    const config = getEnvironmentConfig();

    // Check if origin is allowed
    const isAllowedOrigin =
      config.allowAllOrigins ||
      config.origins.includes(origin) ||
      config.origins.some((allowedOrigin) => {
        // Handle wildcard domains (like *.vercel.app)
        if (allowedOrigin.includes("*")) {
          const regex = new RegExp(
            "^" + allowedOrigin.replace("*", "[^.]*") + "$"
          );
          return regex.test(origin);
        }
        return allowedOrigin === origin;
      });

    const headers = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, token, x-requested-with",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    };

    if (isAllowedOrigin) {
      headers["Access-Control-Allow-Origin"] = origin;
    } else {
      // In production, you can choose to reject or set a default
      // Option 1: Reject by not setting the header
      // Option 2: Set a default origin
      headers["Access-Control-Allow-Origin"] = "https://wealthwise.online";
    }

    return headers;
  } catch (error) {
    // Fallback - more restrictive in production
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
    return {
      "Access-Control-Allow-Origin":
        env === "development" ? "*" : "https://wealthwise.online",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }
}

export function handleOptions(request) {
  try {
    const headers = corsHeaders(request);
    return new Response(null, {
      status: 204, // Use 204 No Content for OPTIONS
      headers: {
        ...headers,
        "Access-Control-Max-Age": "86400", // 24 hours
      },
    });
  } catch (error) {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin":
          env === "development" ? "*" : "https://wealthwise.online",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
}

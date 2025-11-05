// lib/cors.js - Improved version
export function corsHeaders(request) {
  try {
    const origin = request?.headers?.get("origin") || "";

    const allowedOrigins = [
      "http://localhost:3000",
      "https://localhost:3001",
      "https://localhost:3002",
      "https://capitalflowfinance.com",
      "https://www.capitalflowfinance.com",
      "https://wealthwise.online",
      "https://www.wealthwise.online",
    ];

    // Allow requests from any origin in development, specific ones in production
    const isAllowedOrigin =
      process.env.NODE_ENV === "development"
        ? true
        : allowedOrigins.includes(origin);

    const headers = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, token, x-requested-with",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin", // Important for caching
    };

    if (isAllowedOrigin) {
      headers["Access-Control-Allow-Origin"] = origin;
    } else if (process.env.NODE_ENV === "production") {
      // In production, you might want to set a default or reject
      headers["Access-Control-Allow-Origin"] = "https://wealthwise.online";
    }

    return headers;
  } catch (error) {
    // Fallback headers if something goes wrong
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }
}

export function handleOptions(request) {
  try {
    const headers = corsHeaders(request);
    return new Response(null, {
      status: 200,
      headers: {
        ...headers,
        "Access-Control-Max-Age": "86400",
      },
    });
  } catch (error) {
    // Fallback OPTIONS response
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
}

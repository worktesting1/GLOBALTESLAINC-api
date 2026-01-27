// lib/cors.js - Vercel-compatible version
export function corsHeaders(request) {
  try {
    const origin = request?.headers?.get("origin") || "";

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:3001",
      "https://localhost:3000",
      "https://localhost:5173/",
      "https://localhost:3001",
      "https://globalteslainc.online/",
      "https://www.globalteslainc.online",
      "https://admin.globalteslainc.online",
      "https://www.admin.globalteslainc.online",
      // Add Vercel preview URLs
      "https://globalteslainc-api.vercel.app",
      "https://globalteslainc-*.vercel.app",
      "https://*.vercel.app",
    ];

    // Better environment detection for Vercel
    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      process.env.VERCEL_ENV === "development" ||
      process.env.VERCEL_ENV === "preview"; // Allow localhost in preview deployments too

    const isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production";

    // Check if origin is allowed
    const isAllowedOrigin = allowedOrigins.some((allowedOrigin) => {
      if (allowedOrigin.includes("*")) {
        // Handle wildcard domains (like *.vercel.app)
        const regex = new RegExp(
          "^" + allowedOrigin.replace("*", "[^.]*") + "$",
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

    // More flexible origin checking
    if (isDevelopment) {
      // Allow localhost and all origins in development/preview
      headers["Access-Control-Allow-Origin"] = origin || "*";
    } else if (isAllowedOrigin) {
      // Allow specific origins in production
      headers["Access-Control-Allow-Origin"] = origin;
    } else if (isProduction) {
      // Fallback for production
      headers["Access-Control-Allow-Origin"] = origin || "*";
    } else {
      // Default fallback
      headers["Access-Control-Allow-Origin"] = "*";
    }

    return headers;
  } catch (error) {
    // Fallback headers - be more permissive in case of errors
    console.error("CORS Error:", error);
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, token, x-requested-with",
      "Access-Control-Allow-Credentials": "true",
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
    console.error("OPTIONS Handler Error:", error);
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, token, x-requested-with",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
}

// lib/cors.js
export function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";

  const allowedOrigins = [
    "http://localhost:3000",
    "https://localhost:3001",
    "https://localhost:3002",
  ];

  const isAllowedOrigin = allowedOrigins.includes(origin);

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, token, x-requested-with",
    "Access-Control-Allow-Credentials": "true",
  };

  if (isAllowedOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function handleOptions(request) {
  const headers = corsHeaders(request);
  return new Response(null, {
    status: 200,
    headers: {
      ...headers,
      "Access-Control-Max-Age": "86400",
    },
  });
}

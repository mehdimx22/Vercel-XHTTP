// Edge Runtime Data Handler
export const config = { runtime: "edge" };

const _TARGET_BASE = (process.env.TARGET_DOMAIN || "").trim().replace(/\/$/, "");

const _BLOCKED_KEYS = [
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded"
];

export default async function worker(request) {
  if (!_TARGET_BASE) {
    return new Response("Configuration Error: Endpoint not found.", { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const destinationPath = `${_TARGET_BASE}${url.pathname}${url.search}`;

    const safeHeaders = new Headers();
    let remoteIp = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for");

    // Metadata sanitization
    for (const [key, value] of request.headers) {
      const k = key.toLowerCase();
      if (_BLOCKED_KEYS.includes(k) || k.startsWith("x-vercel-") || k.includes("proxy")) {
        continue;
      }
      safeHeaders.set(key, value);
    }

    if (remoteIp) {
      safeHeaders.set("x-forwarded-for", remoteIp.split(',')[0]);
    }

    const fetchOptions = {
      method: request.method,
      headers: safeHeaders,
      redirect: "manual",
      duplex: "half"
    };

    if (!["GET", "HEAD"].includes(request.method)) {
      fetchOptions.body = request.body;
    }

    const result = await fetch(destinationPath, fetchOptions);

    // Return the processed data stream
    return result;

  } catch (err) {
    return new Response(null, { status: 502, statusText: "Service Sync Failure" });
  }
}

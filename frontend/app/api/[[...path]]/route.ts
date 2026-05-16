import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENT_PORT = process.env.PORT ?? "3000";

const BACKEND_CANDIDATES = Array.from(
  new Set(
    [
      process.env.BACKEND_URL,
      "http://backend:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
    ].filter((value): value is string => Boolean(value)).map((value) => value.replace(/\/$/, ""))
  )
);

function isSelfReference(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    const isLoopbackHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");

    return isLoopbackHost && port === CURRENT_PORT;
  } catch {
    return false;
  }
}

function buildTargetUrl(baseUrl: string, pathname: string, search: string) {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const backendPath = pathname === "/api" ? "/" : pathname.replace(/^\/api/, "") || "/";

  return new URL(`${backendPath}${search}`, root);
}

function isReceiptAssetRequest(pathname: string) {
  return pathname.startsWith("/api/receipts/");
}

async function proxyToBackend(req: NextRequest) {
  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();
  const headers = new Headers(req.headers);

  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");
  headers.delete("accept-encoding");

  let lastError: unknown;

  for (const baseUrl of BACKEND_CANDIDATES) {
    if (isSelfReference(baseUrl)) {
      continue;
    }

    const targetUrl = buildTargetUrl(baseUrl, req.nextUrl.pathname, req.nextUrl.search);

    try {
      const response = await fetch(targetUrl, {
        method,
        headers,
        body,
        cache: "no-store",
      });

      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("transfer-encoding");
      responseHeaders.delete("content-length");

      // Receipt previews are binary assets, so stream them through unchanged.
      if (isReceiptAssetRequest(req.nextUrl.pathname)) {
        const body = await response.arrayBuffer();

        return new NextResponse(body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      const contentType = responseHeaders.get("content-type") ?? "";
      const responseText = await response.text();

      // Normalize unexpected HTML/text responses so the browser always gets JSON.
      if (!contentType.includes("application/json")) {
        return NextResponse.json(
          {
            error: responseText || response.statusText || "Unexpected backend response.",
            details: `Backend returned ${contentType || "no content type"} for ${method} ${targetUrl.pathname}.`,
          },
          { status: response.ok ? 502 : response.status }
        );
      }

      return new NextResponse(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      lastError = error;
    }
  }

  const details = lastError instanceof Error ? lastError.message : "No backend endpoint was reachable.";

  return NextResponse.json(
    {
      error: "Failed to connect to the backend service.",
      details,
    },
    { status: 502 }
  );
}

export async function GET(req: NextRequest) {
  return proxyToBackend(req);
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req);
}

export async function PUT(req: NextRequest) {
  return proxyToBackend(req);
}

export async function PATCH(req: NextRequest) {
  return proxyToBackend(req);
}

export async function DELETE(req: NextRequest) {
  return proxyToBackend(req);
}

export async function OPTIONS(req: NextRequest) {
  return proxyToBackend(req);
}

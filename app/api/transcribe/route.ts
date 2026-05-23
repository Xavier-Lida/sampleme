import { normalizeApiUrl } from "@/lib/api/transcribe";

export async function POST(request: Request): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    return Response.json(
      { status: "error", data: null, error: "NEXT_PUBLIC_API_URL is not configured" },
      { status: 500 },
    );
  }

  const upstreamUrl = `${normalizeApiUrl(baseUrl)}/api/transcribe`;
  const formData = await request.formData();

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      body: formData,
    });
  } catch {
    return Response.json(
      {
        status: "error",
        data: null,
        error: "Impossible de joindre le serveur de transcription.",
      },
      { status: 502 },
    );
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}

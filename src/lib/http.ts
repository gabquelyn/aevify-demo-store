import { NextResponse } from "next/server";
import { AevifyError } from "@aevify/node";
import { ZodError } from "zod";
import { ConfigError } from "./env";
import { OrderError } from "./orders";

/** Turn errors into JSON responses with a plain message. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  if (error instanceof OrderError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ConfigError) {
    console.error("[store]", error.message);
    return NextResponse.json({ error: "The store isn't fully configured yet." }, { status: 503 });
  }
  if (error instanceof AevifyError) {
    console.error("[store] Aevify error:", error.message);
    const status = error.status && error.status < 500 ? 502 : 503;
    return NextResponse.json({ error: `Payment service: ${error.message}` }, { status });
  }
  console.error("[store]", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

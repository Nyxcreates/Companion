import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const runtime = "nodejs";

/**
 * TEMPORARY diagnostic-only route. Attempts a direct MongoDB
 * connection using the exact same MONGODB_URI and driver the rest of
 * the app uses, and classifies the failure (DNS / auth / TLS /
 * timeout / other) without ever exposing the URI, username, or
 * password. No auth required — nothing sensitive is returned.
 *
 * Delete this file once the underlying MongoDB issue is resolved;
 * it is not meant to ship in the product.
 */

function extractHostSafely(uri: string): string | null {
  try {
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//, "https://");
    const url = new URL(normalized);
    return url.hostname || null;
  } catch {
    return null;
  }
}

function classify(error: unknown): { category: string; hint: string } {
  const err = error as { name?: string; code?: unknown; message?: string; cause?: { code?: string } };
  const message = (err?.message ?? String(error)).toLowerCase();
  const causeCode = err?.cause?.code ?? "";

  if (
    message.includes("querysrv") ||
    message.includes("enotfound") ||
    message.includes("getaddrinfo") ||
    causeCode === "ENOTFOUND" ||
    causeCode === "EAI_AGAIN"
  ) {
    return {
      category: "DNS_RESOLUTION_FAILED",
      hint: "The hostname in MONGODB_URI could not be resolved. Confirm the cluster hostname is correct and that this machine has working DNS/internet access.",
    };
  }

  if (
    message.includes("bad auth") ||
    message.includes("authentication failed") ||
    message.includes("authenticationfailed")
  ) {
    return {
      category: "AUTHENTICATION_FAILED",
      hint: "MongoDB rejected the username/password. Confirm the database user's password in MONGODB_URI matches Atlas → Database Access exactly (and is URL-encoded if it contains special characters).",
    };
  }

  if (
    message.includes("serverselectionerror") ||
    err?.name === "MongoServerSelectionError"
  ) {
    if (message.includes("connection timed out") || message.includes("timeout")) {
      return {
        category: "SERVER_SELECTION_TIMEOUT",
        hint: "The driver found the cluster but could not open a connection in time — usually Network Access (IP allow-list) or a firewall/VPN blocking outbound port 27017.",
      };
    }
    return {
      category: "SERVER_SELECTION_ERROR",
      hint: "The driver could not select a usable server in the cluster. Could be the cluster being paused, a network block, or an SSL/TLS handshake issue.",
    };
  }

  if (message.includes("ssl") || message.includes("tls")) {
    return {
      category: "TLS_ERROR",
      hint: "A TLS/SSL handshake error occurred. This can happen with outdated Node.js versions or certain corporate/antivirus network interception.",
    };
  }

  if (message.includes("uri") || message.includes("invalid scheme") || message.includes("invalid connection string")) {
    return {
      category: "MALFORMED_URI",
      hint: "MONGODB_URI does not appear to be a valid connection string — check for missing scheme, stray quotes, or a missing '@' separator.",
    };
  }

  return {
    category: "UNCLASSIFIED",
    hint: "The error didn't match a known pattern — see rawMessage below for the exact driver error.",
  };
}

export async function GET() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return NextResponse.json({
      uriPresent: false,
      host: null,
      connected: false,
      category: "URI_NOT_SET",
      hint: "MONGODB_URI is not set in .env.local (or the dev server wasn't restarted after adding it).",
    });
  }

  const host = extractHostSafely(uri);

  try {
    // Deliberately does NOT use the app's cached connection — this is
    // an isolated attempt so a poisoned cache elsewhere can't mask or
    // mimic the result here.
    const conn = await mongoose.createConnection(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    }).asPromise();

    await conn.close();

    return NextResponse.json({
      uriPresent: true,
      host,
      connected: true,
      category: "OK",
      hint: "Direct connection succeeded. If onboarding still fails, the problem is downstream of the connection itself (e.g. in the profile save logic), not connectivity.",
    });
  } catch (error) {
    const err = error as { name?: string; code?: unknown; message?: string; cause?: unknown };
    const { category, hint } = classify(error);

    // Server-side log only — full detail, never sent to the client
    // beyond the already-sanitized fields below.
    // eslint-disable-next-line no-console
    console.error(
      [
        "[Companion] Diagnostic MongoDB connection failed",
        `Error name: ${err?.name ?? "unknown"}`,
        `Error code: ${err?.code !== undefined ? String(err.code) : "none"}`,
        `Error message: ${err?.message ?? String(error)}`,
        `Error cause: ${err?.cause !== undefined ? String(err.cause) : "none"}`,
        `Host: ${host ?? "could not be parsed"}`,
      ].join("\n")
    );

    return NextResponse.json({
      uriPresent: true,
      host,
      connected: false,
      category,
      hint,
      errorName: err?.name ?? "unknown",
      errorCode: err?.code !== undefined ? String(err.code) : null,
      rawMessage: err?.message ?? String(error),
    });
  }
}
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    await connectToDatabase();
    return NextResponse.json({ data: { status: "ok", database: "connected" } });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message: "Database connection failed.",
          code: "DB_CONNECTION_ERROR",
        },
      },
      { status: 500 }
    );
  }
}
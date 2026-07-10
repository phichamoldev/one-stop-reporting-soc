import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    for (const event of body.events || []) {
      console.log("SOURCE:", event.source);

      if (event.source?.type === "group") {
        console.log("GROUP ID:", event.source.groupId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false });
  }
}


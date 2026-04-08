import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  deleteAllChatsByUserId,
  getChatsByUserId,
  getOrCreateUser,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "10", 10), 1),
    50,
  );
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return new ChatbotError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided.",
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  try {
    const dbUser = await getOrCreateUser({
      id: session.user.id,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
    });
    const userUUID = dbUser.id;

    const chats = await getChatsByUserId({
      id: userUUID,
      limit,
      startingAfter,
      endingBefore,
    });

    return Response.json(chats);
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("bad_request:history").toResponse();
  }
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const dbUser = await getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  });
  const userUUID = dbUser.id;

  const result = await deleteAllChatsByUserId({ userId: userUUID });

  return Response.json(result, { status: 200 });
}

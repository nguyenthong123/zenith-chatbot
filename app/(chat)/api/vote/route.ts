import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getChatById, getVotesByChatId, voteMessage } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isValidUUID } from "@/lib/utils";

const voteSchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
  type: z.enum(["up", "down"]),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new ChatbotError(
      "bad_request:api",
      "Parameter chatId is required.",
    ).toResponse();
  }

  if (!isValidUUID(chatId)) {
    return new ChatbotError("bad_request:api", "Invalid chatId").toResponse();
  }

  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:vote").toResponse();
    }

    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return new ChatbotError("not_found:chat").toResponse();
    }

    if (chat.userId !== session.user.id) {
      return new ChatbotError("forbidden:vote").toResponse();
    }

    const votes = await getVotesByChatId({ id: chatId });

    return Response.json(votes, { status: 200 });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("bad_request:api").toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = voteSchema.parse(body);
    const { chatId, messageId, type } = parsed;

    if (!isValidUUID(chatId) || !isValidUUID(messageId)) {
      return new ChatbotError(
        "bad_request:api",
        "Invalid UUID for chatId or messageId",
      ).toResponse();
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:vote").toResponse();
    }

    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return new ChatbotError("not_found:vote").toResponse();
    }

    if (chat.userId !== session.user.id) {
      return new ChatbotError("forbidden:vote").toResponse();
    }

    await voteMessage({
      chatId,
      messageId,
      type,
    });

    return new Response("Message voted", { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatbotError(
        "bad_request:api",
        "Parameters chatId, messageId, and type are required.",
      ).toResponse();
    }
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("bad_request:api").toResponse();
  }
}

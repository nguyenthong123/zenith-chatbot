import { auth } from "@/app/(auth)/auth";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { generateStableUUID, isValidUUID } from "@/lib/utils";
import { convertToUIMessages } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return Response.json({ error: "chatId required" }, { status: 400 });
  }

  try {
    const chatUUID = isValidUUID(chatId) ? chatId : generateStableUUID(chatId);
    const [session, chat, messages] = await Promise.all([
      auth(),
      getChatById({ id: chatUUID }),
      getMessagesByChatId({ id: chatUUID }),
    ]);

    if (!chat) {
      return Response.json({
        messages: [],
        visibility: "private",
        userId: null,
        isReadonly: false,
      });
    }

    const userUUID = session?.user?.id ? (isValidUUID(session.user.id) ? session.user.id : generateStableUUID(session.user.id)) : null;

    if (
      chat.visibility === "private" &&
      (!userUUID || userUUID !== chat.userId)
    ) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const isReadonly = !userUUID || userUUID !== chat.userId;

    return Response.json({
      messages: convertToUIMessages(messages),
      visibility: chat.visibility,
      userId: chat.userId,
      isReadonly,
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Unhandled error in api/messages:", error);
    return new ChatbotError("bad_request:api").toResponse();
  }
}

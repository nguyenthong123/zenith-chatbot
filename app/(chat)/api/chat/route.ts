import "@/lib/polyfills";
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/app/(auth)/auth";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { getBillingLookup } from "@/lib/ai/tools/billing-lookup";
import { getCashBookLookup } from "@/lib/ai/tools/cash-book-lookup";
import { getChatHistorySearch } from "@/lib/ai/tools/chat-history";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getCustomerLookup } from "@/lib/ai/tools/customer-lookup";
import { getDatabaseDiagnostics } from "@/lib/ai/tools/diagnostic";
import { getDocumentSearch } from "@/lib/ai/tools/document-search";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { knowledgeBaseLookup } from "@/lib/ai/tools/knowledge-base-lookup";
import { getOrderLookup } from "@/lib/ai/tools/order-lookup";
import { getOrderSupabaseLookup } from "@/lib/ai/tools/order-supabase-lookup";
import { getProductLookup } from "@/lib/ai/tools/product-lookup";
import { readPdf } from "@/lib/ai/tools/read-pdf";
import { readUrl } from "@/lib/ai/tools/read-url";
import { requestProductUploadTool } from "@/lib/ai/tools/request-product-upload";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { saveKnowledge } from "@/lib/ai/tools/save-knowledge";
import { getSaveProductTool } from "@/lib/ai/tools/save-product";
import { syncFirestoreToSupabase } from "@/lib/ai/tools/sync-firestore";
import { getSystemInfo } from "@/lib/ai/tools/system-info";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { getUserLookup } from "@/lib/ai/tools/user-lookup";
import { webSearch } from "@/lib/ai/tools/web-search";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  getOrCreateUser,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import {
  convertToUIMessages,
  generateStableUUID,
  generateUUID,
  isValidUUID,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let parsedBody: PostRequestBody;
    try {
      parsedBody = postRequestBodySchema.parse(body);
    } catch (_error) {
      return new ChatbotError("bad_request:api").toResponse();
    }

    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      parsedBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const userUUID = isValidUUID(session.user.id)
      ? session.user.id
      : generateStableUUID(session.user.id);
    const chatUUID = isValidUUID(id) ? id : generateStableUUID(id);

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    const chat = await getChatById({ id: chatUUID });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== userUUID) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id: chatUUID });
    } else {
      await getOrCreateUser({
        id: userUUID,
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      });

      if (message?.role === "user") {
        titlePromise = generateTitleFromUserMessage({ message });
        await saveChat({
          id: chatUUID,
          userId: userUUID,
          title: "New Chat",
          visibility: selectedVisibilityType || "private",
        });
      }
    }

    let uiMessages: ChatMessage[];

    const isToolApprovalFlow = Boolean(messages);

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied",
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? [],
        ),
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    // Inject attachment URLs into messages
    uiMessages.forEach((msg) => {
      if (
        msg.role === "user" &&
        msg.attachments &&
        msg.attachments.length > 0
      ) {
        const toolRelevantAttachments = msg.attachments.filter(
          (a) =>
            a.contentType?.includes("pdf") ||
            a.name?.toLowerCase().endsWith(".pdf") ||
            a.contentType?.includes("image") ||
            a.name?.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i),
        );

        if (toolRelevantAttachments.length > 0) {
          const attachmentText = toolRelevantAttachments
            .map(
              (a, idx) =>
                `${idx + 1}. [${a.name}](${a.url}) (${a.contentType})`,
            )
            .join("\n");

          const suffix = `\n\nAttachment URLs (for tool use):\n${attachmentText}`;

          // Find the first text part and append if not already there
          const textPart = msg.parts.find((p) => p.type === "text");
          if (textPart && "text" in textPart) {
            if (!textPart.text.includes("Attachment URLs (for tool use):")) {
              textPart.text += suffix;
            }
          } else {
            msg.parts.push({
              type: "text",
              text: `Attachment URLs (for tool use):\n${attachmentText}`,
            });
          }
        }
      }
    });

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      const normalizedMsgId = isValidUUID(message.id)
        ? message.id
        : generateStableUUID(message.id);

      await saveMessages({
        messages: [
          {
            chatId: chatUUID,
            id: normalizedMsgId,
            role: "user",
            parts: message.parts,
            attachments: message.attachments ?? [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getLanguageModel(chatModel),
          system: systemPrompt({
            requestHints,
            supportsTools,
            userRole: session?.user?.role || "user",
            userName: session?.user?.name,
            userEmail: session?.user?.email,
          }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            isReasoningModel && !supportsTools
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "editDocument",
                  "updateDocument",
                  "requestSuggestions",
                  "webSearch",
                  "readUrl",
                  "readPdf",
                  "productLookup",
                  "saveProduct",
                  "customerLookup",
                  "orderLookup",
                  "orderSupabaseLookup",
                  "userLookup",
                  "billingLookup",
                  "cashBookLookup",
                  "knowledgeBaseLookup",
                  "saveKnowledge",
                  "syncFirestoreToSupabase",
                  "searchChatHistory",
                  "documentSearch",
                  "getSystemInfo",
                  "manageUserMemory",
                  "requestProductUpload",
                ],
          providerOptions: {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          },
          tools: {
            getWeather,
            webSearch,
            readUrl,
            readPdf,
            createDocument: createDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            editDocument: editDocument({ dataStream, session }),
            updateDocument: updateDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              modelId: chatModel,
            }),
            productLookup: getProductLookup(
              userUUID,
              session.user.role || "user",
              session.user.email ?? undefined,
            ),
            saveProduct: getSaveProductTool(
              userUUID,
              session.user.email ?? undefined,
            ),
            customerLookup: getCustomerLookup(
              userUUID,
              session.user.role || "user",
              session.user.email ?? undefined,
            ),
            orderLookup: getOrderLookup(
              userUUID,
              session.user.role || "user",
              session.user.email ?? undefined,
            ),
            orderSupabaseLookup: getOrderSupabaseLookup(
              session.user.id,
              session.user.role || "user",
              session.user.email,
            ),
            userLookup: getUserLookup(
              session.user.id,
              session.user.role || "user",
              session.user.email,
            ),
            billingLookup: getBillingLookup(
              userUUID,
              session.user.role || "user",
              session.user.email ?? undefined,
            ),
            cashBookLookup: getCashBookLookup(
              userUUID,
              session.user.role || "user",
              session.user.email ?? undefined,
            ),
            knowledgeBaseLookup,
            saveKnowledge: saveKnowledge(userUUID),
            syncFirestoreToSupabase,
            searchChatHistory: getChatHistorySearch(userUUID),
            documentSearch: getDocumentSearch(userUUID),
            getSystemInfo: getSystemInfo(),
            manageUserMemory: getManageUserMemory(userUUID),
            getDatabaseDiagnostics: getDatabaseDiagnostics(),
            requestProductUpload: requestProductUploadTool,
          },
          experimental_telemetry: {
            isEnabled: process.env.NODE_ENV === "production",
            functionId: "stream-text",
          },
        });

        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel }),
        );

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: chatUUID, title });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: isValidUUID(finishedMsg.id)
                  ? finishedMsg.id
                  : generateStableUUID(finishedMsg.id),
                parts: finishedMsg.parts,
              });
            } else {
              const messageId = isValidUUID(finishedMsg.id)
                ? finishedMsg.id
                : generateStableUUID(finishedMsg.id);
              await saveMessages({
                messages: [
                  {
                    id: messageId,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: chatUUID,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => {
              const messageId = isValidUUID(currentMessage.id)
                ? currentMessage.id
                : generateStableUUID(currentMessage.id);
              return {
                id: messageId,
                role: currentMessage.role,
                parts: currentMessage.parts,
                createdAt: new Date(),
                attachments: currentMessage.attachments ?? [],
                chatId: chatUUID,
              };
            }),
          });
        }
      },
      onError: (error) => {
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests",
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateUUID();
            await createStreamId({ streamId, chatId: chatUUID });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream,
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const _vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests",
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}

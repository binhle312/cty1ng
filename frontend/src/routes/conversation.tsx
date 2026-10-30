import { ConversationId } from "@cty1ng/shared/ids";
import { createRoute, notFound } from "@tanstack/react-router";
import { emptyIn, PlaceholderPage } from "../features/placeholder/placeholder-page.tsx";
import { rootRoute } from "./root.tsx";

// `/c/conv_…`: a conversation, by its TypeID (M0c plan, decision G). Any other value is not a
// page.
export const conversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/c/$conversationId",
  beforeLoad: ({ params }) => {
    if (!ConversationId.safeParse(params.conversationId).success) {
      // TanStack Router stops a route with the value notFound() returns; it is not an Error.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw notFound();
    }
  },
  component: () => <PlaceholderPage title="Conversation" line={emptyIn("M3")} />,
});

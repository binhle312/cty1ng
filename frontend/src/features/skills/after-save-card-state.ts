import type { ListSkillUpgradeCandidatesResponse } from "../../lib/api/generated/types.gen.ts";

// The bot card after a save (skills-page.md §7). Each save asks for its card when it answers, and
// the card opens when the app has read the bots. Pure: no React, no request, no clock;
// `after-save-cards.tsx` holds the state and shows the toasts this module asks for
// (frontend-conventions.md §1).
//
//                       | The newest save asked, | A newer save asked | The page is gone
//                       | and the page is here   |                    |
// ----------------------+------------------------+--------------------+-----------------
// The read of a card    | The card opens         | Its toast; a newer | Its toast
// ends                  |                        | card stays         |
//
//                       | The card on screen     | Another card, or none
// ----------------------+------------------------+-----------------------
// A card asks to close  | It closes              | Nothing

type Candidate = ListSkillUpgradeCandidatesResponse[number];

export type AfterSaveCard =
  | {
      kind: "upgrade";
      skillId: string;
      skillName: string;
      version: number;
      versionId: string;
      candidates: Candidate[];
    }
  | { kind: "assign"; skillId: string; skillName: string; versionId: string };

// The toasts that stand for a card: when no bot fits, or when the card cannot show.
export const savedToast = (version: number) => `Saved v${String(version)} ✨`;
export const createdToast = (skillName: string) => `Created ${skillName} ✨`;

export function cardToast(card: AfterSaveCard): string {
  return card.kind === "upgrade" ? savedToast(card.version) : createdToast(card.skillName);
}

export interface AfterSaveCardState {
  // The saves that asked for a card so far; a read's turn is the count when it asked.
  asked: number;
  pageHere: boolean;
  card: AfterSaveCard | null;
  // Toasts to show; the store shows them at once and drops them.
  toasts: readonly string[];
}

export type AfterSaveCardEvent =
  | { type: "asked" }
  // A read that found no bot to list shows its own toast and sends no event.
  | { type: "cardRead"; turn: number; card: AfterSaveCard }
  | { type: "closed"; card: AfterSaveCard }
  | { type: "pageEntered" }
  | { type: "pageLeft" };

export function initialAfterSaveCardState(): AfterSaveCardState {
  return { asked: 0, pageHere: true, card: null, toasts: [] };
}

export function afterSaveCardReducer(
  state: AfterSaveCardState,
  event: AfterSaveCardEvent,
): AfterSaveCardState {
  switch (event.type) {
    case "asked":
      return { ...state, asked: state.asked + 1 };
    case "cardRead":
      return state.pageHere && event.turn === state.asked
        ? { ...state, card: event.card }
        : { ...state, toasts: [...state.toasts, cardToast(event.card)] };
    case "closed":
      return state.card === event.card ? { ...state, card: null } : state;
    case "pageEntered":
      return state.pageHere ? state : { ...state, pageHere: true };
    case "pageLeft":
      return { ...state, pageHere: false, card: null };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

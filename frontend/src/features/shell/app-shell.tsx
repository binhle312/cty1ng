import { useCallback, type ReactNode } from "react";
import { Toaster } from "../../components/ui/toast.tsx";
import { BarTwo } from "./bar-two.tsx";
import { useBarTwo, useToggleKey } from "./bar-two-state.ts";
import { Rail } from "./rail.tsx";
import { TopHeader } from "./top-header.tsx";
import { UserPanel } from "./user-panel.tsx";

// The frame around every page (requirements/app-shell.md): the left bar (rail, bar 2 and the
// floating user panel) fills the window height, the header stays at the top, and only the
// main area scrolls (UI-1.13, UI-2.11). DOM order is the Tab order: rail, bar 2, user panel,
// header, main.
export function AppShell({ children }: { children: ReactNode }) {
  const barTwo = useBarTwo();
  const { hiddenByOwner, setHidden } = barTwo;
  useToggleKey(
    useCallback(() => {
      setHidden(!hiddenByOwner);
    }, [hiddenByOwner, setHidden]),
  );

  return (
    <div className="flex h-full overflow-hidden bg-surface text-on-surface">
      <div className="relative flex h-full shrink-0" data-testid="left-bar">
        <Rail
          onHome={() => {
            // A click on the Home tile shows a hidden bar 2 again (left-bar.md, card 12).
            if (barTwo.hiddenByOwner) barTwo.setHidden(false);
          }}
        />
        {!barTwo.hidden && (
          <BarTwo
            onHide={() => {
              barTwo.setHidden(true);
            }}
          />
        )}
        <UserPanel collapsed={barTwo.hidden} />
      </div>
      <div className="flex min-w-0 grow flex-col">
        <TopHeader />
        <main id="main" className="min-h-0 grow overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

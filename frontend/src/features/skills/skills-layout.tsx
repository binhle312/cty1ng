import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "../../components/ui/toast.tsx";
import { type AfterSaveCard, AfterSaveCardHost, cardToast } from "./after-save-cards.tsx";
import { SkillList } from "./skill-list.tsx";
import { SkillsPageContext, type SkillsPageState } from "./skills-context.tsx";

// The Skills page (skills-page.md §2): the list column and, beside it, the skill page, the new
// skill editor or the import page.
export function SkillsLayout() {
  const navigate = useNavigate();
  const [dirtySlug, setDirtySlug] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [botCard, setBotCard] = useState<AfterSaveCard | null>(null);
  // A card that comes after the owner left the Skills page shows as its toast instead.
  // Each save asks for its card in turn, when the save answers. A card that comes after a newer
  // save asked for its own also shows as its toast: an older answer never replaces a newer card,
  // nor comes after the toast that stood for it (skills-page.md §7).
  const asked = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const fileInput = useRef<HTMLInputElement>(null);

  const state = useMemo<SkillsPageState>(
    () => ({
      dirtySlug,
      setDirtySlug,
      importFile,
      chooseImportFile: () => fileInput.current?.click(),
      clearImportFile: () => {
        setImportFile(null);
      },
      showBotCard: (coming: Promise<AfterSaveCard | null>) => {
        asked.current += 1;
        const turn = asked.current;
        void coming.then((card) => {
          if (card === null) return;
          if (mounted.current && turn === asked.current) setBotCard(card);
          else showToast(cardToast(card));
        });
      },
    }),
    [dirtySlug, importFile],
  );

  return (
    <SkillsPageContext.Provider value={state}>
      <div className="flex h-full min-h-0">
        <SkillList />
        <section className="flex h-full min-w-0 grow flex-col">
          <Outlet />
        </section>
      </div>
      <AfterSaveCardHost
        card={botCard}
        onClose={(closed) => {
          // A late answer of an older card never closes a newer one.
          setBotCard((current) => (current === closed ? null : current));
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        aria-label="Choose a zip to import"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file === undefined) return;
          setImportFile(file);
          void navigate({ to: "/skills/import" });
        }}
      />
    </SkillsPageContext.Provider>
  );
}

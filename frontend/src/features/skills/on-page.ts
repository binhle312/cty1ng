import { useLayoutEffect, useRef } from "react";

// Whether this page is still there, for a request that can end after the owner left (DQ-020,
// skills-page.md "Edge cases"). A layout cleanup runs in the commit that removes the page, so no
// answer lands in between. A later visit is a new page, so an old request moves nothing there.
export function useOnPage() {
  const onPage = useRef(true);
  useLayoutEffect(() => {
    onPage.current = true;
    return () => {
      onPage.current = false;
    };
  }, []);
  return onPage;
}

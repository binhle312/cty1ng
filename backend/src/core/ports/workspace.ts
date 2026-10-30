// The workspace port (architecture.md §2, security.md §2.3). Types only: the local-git adapter
// comes in M6, which may change this interface with the owner's review. `resolve()` is the only
// way a workspace path becomes a disk path (AGENTS.md §5 rule 7).
export interface Workspace {
  resolve(place: string, path: string): Promise<string>;
  read(place: string, path: string): Promise<string>;
  write(place: string, path: string, content: string): Promise<void>;
  commit(place: string, message: string): Promise<string>; // the commit sha
  changedSince(place: string, sha: string): Promise<string[]>;
  openFolder(place: string): Promise<void>;
}

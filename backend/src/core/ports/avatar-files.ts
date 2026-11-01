// The avatar store (M2 plan, decision 1; domain-model.md §2 Avatar files). The adapter only
// keeps files and their times; the services decide whether a file is used, because only the
// database knows which rows name it.
//
// Order of an upload: the slow work (decode, re-encode, hash, `stage`) runs before the write
// lock. `publish` runs inside `uow.run`, so it and the cleanup's check and delete never
// interleave. SQLite rollback does not undo a file write, so every file the store can leave
// behind after a failure is either a staged file or an unused published file, and the cleanup
// removes both after the grace period.

export interface StagedAvatar {
  readonly avatarId: string;
  // The adapter's name for the staged file.
  readonly token: string;
}

export interface AvatarFileTime {
  readonly name: string;
  readonly modifiedAt: Date;
}

export interface AvatarFiles {
  // Writes the bytes to a temporary file and makes them durable. Outside any transaction.
  stage(avatarId: string, bytes: Uint8Array): Promise<StagedAvatar>;
  // Inside the write lock: moves the staged file to its final name. When that name exists (an
  // upload of the same image), it sets the existing file's time to `now` and deletes the staged
  // file instead. Atomic: the final file is either the whole image or absent.
  publish(staged: StagedAvatar, now: Date): Promise<void>;
  // Deletes a staged file that was not published (the upload failed). Never throws.
  discard(staged: StagedAvatar): Promise<void>;
  exists(avatarId: string): Promise<boolean>;
  // Sets the file's time to `now`: it stopped being used, so its grace period starts again.
  // Does nothing when the file is gone.
  touch(avatarId: string, now: Date): Promise<void>;
  // Published files: `name` is the avatar id.
  list(): Promise<AvatarFileTime[]>;
  // Staged files that were never published or discarded (a crash): `name` is the token.
  listStaged(): Promise<AvatarFileTime[]>;
  // The time of one published file read again, or null when it is gone.
  modifiedAt(avatarId: string): Promise<Date | null>;
  // Delete one file; a file that is already gone is not an error.
  remove(avatarId: string): Promise<void>;
  removeStaged(token: string): Promise<void>;
  // The bytes of a published file, or null.
  read(avatarId: string): Promise<Uint8Array | null>;
}

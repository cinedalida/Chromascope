// Loading a page's code on demand can fail: after a new deploy an old tab asks for a file that no longer exists, or the
// connection drops. This wraps an import() so that such a failure reloads the page ONCE (the reload fetches the new
// version), and a second failure is thrown so a message can be shown instead of an endless reload loop.
// Pure (storage and reload are injected), so it runs under `npm run test:unit`.

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|ChunkLoadError/i;

/** Whether an error is "the code for this page could not be downloaded". */
export const isChunkLoadError = (error) => CHUNK_ERROR.test(String(error?.message ?? error ?? ""));

const KEY = "chromascope:chunk-reload";

export function importWithReload(
  importer,
  { getStorage = () => globalThis.sessionStorage, reload = () => globalThis.location.reload(), key = KEY } = {},
) {
  // Reading sessionStorage can throw (blocked site data); then there is no safe way to avoid a reload loop, so never reload.
  const store = () => {
    try {
      return getStorage() ?? null;
    } catch {
      return null;
    }
  };
  return importer().then(
    (module) => {
      try {
        store()?.removeItem(key); // loaded fine: the next failure may reload again
      } catch {
        /* ignore */
      }
      return module;
    },
    (error) => {
      const storage = store();
      if (isChunkLoadError(error) && storage) {
        let firstFailure;
        try {
          firstFailure = !storage.getItem(key);
          if (firstFailure) storage.setItem(key, String(Date.now()));
        } catch {
          firstFailure = false;
        }
        if (firstFailure) {
          reload();
          return new Promise(() => {}); // the page is reloading; nothing to show in the meantime
        }
      }
      throw error;
    },
  );
}

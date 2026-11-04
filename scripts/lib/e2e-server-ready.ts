// How Playwright decides that a server it started is up. With a url it takes any answer on the
// port, and it does not notice when its own process then fails on that port, so its tests would
// write into another server. A server of a fresh local run must prove itself with the backend's
// "listening" log line on its own stdout: it comes after the bind, and no other process can write
// it (docs/testing.md §3).
export function listeningLine(port: number): RegExp {
  return new RegExp(`"port":${String(port)}\\b.*"msg":"listening"`);
}

// Reusing servers needs the url, because a reused server has no stdout here. CI starts on a clean
// machine and keeps the url.
export function serverReadyCheck(options: { port: number; ownLine: boolean }) {
  return options.ownLine
    ? { wait: { stdout: listeningLine(options.port) } }
    : { url: `http://127.0.0.1:${String(options.port)}/api/health` };
}

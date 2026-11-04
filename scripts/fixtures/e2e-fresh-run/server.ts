// A stand-in for the backend: it binds the port, then prints the "listening" line.
import { createServer } from "node:http";

const port = Number(process.env.PORT);
// Lets the test put another server on the port after Playwright started this process.
const beforeBind = process.env.BEFORE_BIND_URL;
if (beforeBind !== undefined) await fetch(beforeBind);

const server = createServer((_request, response) => response.end("{}"));
server.on("error", () => process.exit(1));
server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ level: 30, port, msg: "listening" }));
});

import { MatrixAuth } from "matrix-bot-sdk";

// This will be the URL where clients can reach your homeserver. Note that this might be different
// from where the web/chat interface is hosted. The server must support password registration without
// captcha or terms of service (public servers typically won't work).
const homeserverUrl = "https://matrix.camino.network";

const auth = new MatrixAuth(homeserverUrl);
// ping bot creds
//const client = await auth.passwordRegister("bottestaccount", "kvjYNPanb3N5czqbEsuA");
// pong bot creds
const client = await auth.passwordRegister("pongbot", "EZW0xxQECgOmZOpEjVDt");

//const client = await auth.passwordLogin("bottestaccount", "kvjYNPanb3N5czqbEsuA");

console.log("Copy this access token to your bot's config: ", client.accessToken);

import { MatrixAuth } from "matrix-bot-sdk";
import crypto from 'crypto';
import fs from 'fs';

// This will be the URL where clients can reach your homeserver. Note that this might be different
// from where the web/chat interface is hosted. The server must support password registration without
// captcha or terms of service (public servers typically won't work).
const proto = "http";
const port = 8008;

let configname = "default";
let homeserverUrl = "localhost";
let homeserver_type = "synapse"; // can also be "dendrite" or "conduit"

if(process.argv.length > 2) {
	configname = process.argv[2];
}
if(process.argv.length > 3) {
	homeserverUrl = process.argv[3];
}
if(process.argv.length > 4) {
	homeserver_type = process.argv[4];
}

let matrix_url = proto + "://" + homeserverUrl + ":" + port;

console.log("Using config: ", configname, " and homeserver: ", matrix_url, " for registration.");

async function register(auth : MatrixAuth, username : string, password : string) {
	const client = await auth.passwordRegister(username, password);
	console.log("Registered user '", username, "' with token: ", client.accessToken);
	return client.accessToken;
}

const auth = new MatrixAuth(matrix_url);

// Generate random password for both bots
const pingbot_password = crypto.randomBytes(10).toString('hex');
const pongbot_password = crypto.randomBytes(10).toString('hex');

const register_id = crypto.randomBytes(4).toString('hex');
const pingbot_user = "pingbot_" + register_id;
const pongbot_user = "pongbot_" + register_id;

// ping bot creds
let pingbot_token = await register(auth, pingbot_user, pingbot_password);

// pong bot creds
let pongbot_token = await register(auth, pongbot_user, pongbot_password);

// write the config file as json
let config = {
	"pingbot": {
		"username": pingbot_user,
		"token": pingbot_token,
		"password": pingbot_password
	},
	"pongbot": {
		"username": pongbot_user,
		"token": pongbot_token,
		"password": pongbot_password
	},
	"hs_proto": "http",
	"hs_host": homeserverUrl,
	"hs_port": 8008,
	"hs_type": homeserver_type
};
fs.writeFileSync(configname, JSON.stringify(config, null, '\t'));
console.log("Wrote config to ", configname);
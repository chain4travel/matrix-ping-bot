import { 
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin,
} from "matrix-bot-sdk";

import fs from 'fs';

// read the configuration which has been written by register.ts
if(process.argv.length < 3) {
	console.log("Please specify a config file name as argument");
	process.exit(1);
}

let configname = process.argv[2];
let config = JSON.parse(fs.readFileSync(configname, 'utf8'));

const server_identifier = config.hs_host;
const server_port = config.hs_port; // Only needed for local testing

// This will be the URL where clients can reach your homeserver. Note that this might be different
// from where the web/chat interface is hosted. The server must support password registration without
// captcha or terms of service (public servers typically won't work).
const homeserverUrl = config.hs_proto + "://" + server_identifier + ":" + server_port;

// Access tokens are read from the configuration
const accessToken = config.pongbot.token;

// In order to make sure the bot doesn't lose its state between restarts, we'll give it a place to cache
// any information it needs to. You can implement your own storage provider if you like, but a JSON file
// will work fine for this example.
const storage = new SimpleFsStorageProvider("pong-bot.json");

// Finally, let's create the client and set it to autojoin rooms. Autojoining is typical of bots to ensure
// they can be easily added to any room.
const client = new MatrixClient(homeserverUrl, accessToken, storage);
AutojoinRoomsMixin.setupOnClient(client);

// Before we start the bot, register our command handlers
client.on("room.message", handleRoomMessage);
client.on("room.event", handleRoomEvent);
client.on("account_data", handleAccountData);
client.on("room.account_data", handleRoomAccountData);
client.on("room.join", handleRoomJoin);
client.on("room.leave", handleRoomLeave);

// Now that everything is set up, start the bot. This will start the sync loop and run until killed.
client.start().then(() => console.log("Pong bot started!"));

async function handleRoomMessage(roomId: string, event: any) {
	//console.log("RoomMessage:", event);

    // Don't handle unhelpful events (ones that aren't text messages, are redacted, or sent by us)
    if (event['content']?.['msgtype'] !== 'm.text') return;
    if (event['sender'] === await client.getUserId()) return;
    
    // Check to ensure that the `!hello` command is being run
    const body : string = event['content']['body'];

    if (body?.includes("ping")) {
		console.log("Got " + body);
		let content = body.replace("ping", "pong");
		await client.sendText(roomId, content);
	}

	if (body?.startsWith("test finished - leaving room")) {
		//The pingbot has left the room, and so should we.
		//Also we should call forget that the server can clean up the room.
		await client.leaveRoom(roomId);
	}

	if(body?.startsWith("reset")) {
		// Leave all the joined rooms except the one this message was sent in
		let joined_rooms = await client.getJoinedRooms();
		for(let rid of joined_rooms) {
			if(rid !== roomId) {
				await client.leaveRoom(rid);
			}
		}
	}
}

async function handleRoomEvent(roomId: string, event: any) {
	console.log("RoomEvent:", event);
}

async function handleAccountData(event: any) {
	console.log("AccountData:", event);
}

async function handleRoomAccountData(roomId: string, event: any) {
	console.log("RoomAccountData:", event);
}

async function handleRoomJoin(roomId: string, event: any) {
	console.log("RoomJoin:", event);
}

async function handleRoomLeave(roomId: string, event: any) {
	console.log("RoomLeave:", event);
	if(event.content?.sender === "@" + config.pingbot.username + ":" + server_identifier) {
		// The bottest account has left the room so we should leave too
		await client.leaveRoom(roomId);
	}
	
	if(event.content?.sender === await client.getUserId()) {
		//We left the room, so we should forget it
		await client.forgetRoom(roomId);
	}
}



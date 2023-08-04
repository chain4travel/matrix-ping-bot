import { 
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin,
} from "matrix-bot-sdk";

// This will be the URL where clients can reach your homeserver. Note that this might be different
// from where the web/chat interface is hosted. The server must support password registration without
// captcha or terms of service (public servers typically won't work).
const homeserverUrl = "https://matrix.camino.network";

// Use the access token you got from login or registration above.
const accessToken = "syt_cG9uZ2JvdA_KzmIprKdAHOaaNcxiXjv_3BeHmk";

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

	/* no need to join manually - the pongbot is being invited to a room by the pingbot */
	/*
	if(body?.startsWith("creating new testrooms with aliases")) {
		let aliases = JSON.parse(body.replace("creating new testrooms with aliases:",''));
		console.log("Got aliases to join: " + aliases);

		for(let alias of aliases) {
			await client.joinRoom(alias);
		}
	}
	*/
    
    // Now that we've passed all the checks, we can actually act upon the command
    //await client.replyNotice(roomId, event, "Hello world!");
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
}



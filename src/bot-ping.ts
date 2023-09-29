import { 
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin,
	LogService,
	LogLevel,
	RichConsoleLogger
} from "matrix-bot-sdk";

import fs from 'fs';
import { Mutex } from "async-mutex";

const sleep = (milliseconds : number) => {
	return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function minMaxAvg(arr : number[]) : number[] {
	var max = arr[0];
	var min = arr[0];
	var sum = 0 ;
	arr.forEach(function(value){
		if(value > max)
			max = value;
		if(value < min)
			min = value;
		sum +=value;
	})
	var avg = sum/arr.length;
	return [min,max,avg];
}

// read the configuration which has been written by register.ts
if(process.argv.length < 3) {
	console.log("Please specify a config file name as argument");
	process.exit(1);
}
let configname = process.argv[2];
let config = JSON.parse(fs.readFileSync(configname, 'utf8'));

const server_identifier = config.hs_host;
const server_port = config.hs_port; 

// Beware - the pongbot id is without the port for dendrite and conduit but with the port for synapse!
let pongbot_id = "@" + config.pongbot.username + ":" + server_identifier;
if(config.hs_type === "synapse") {
	pongbot_id += ":" + server_port;
}

LogService.setLogger(new RichConsoleLogger());
LogService.setLevel(LogLevel.DEBUG);

// This will be the URL where clients can reach your homeserver. Note that this might be different
// from where the web/chat interface is hosted. The server must support password registration without
// captcha or terms of service (public servers typically won't work).
const homeserverUrl = config.hs_proto + "://" + server_identifier + ":" + server_port;

// Access tokens are read from the configuration
const accessToken = config.pingbot.token;

// In order to make sure the bot doesn't lose its state between restarts, we'll give it a place to cache
// any information it needs to. You can implement your own storage provider if you like, but a JSON file
// will work fine for this example.
const storage = new SimpleFsStorageProvider("ping-bot.json");

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

let roundtrip_testvalues = {
	starttime: 0,
	endtime: 0,
	number: 0, 
	latencies: [0]
}

let parallel_testvalues = {
	starttime: 0,
	endtime: 0,
	number: 0,
	pongcount: 0,
	pongcountmutext: new Mutex()
}

let parallel_rooms_testvalues = {
	starttime: 0,
	endtime: 0,
	room_number: 0,
	roundrtip_number: 0,
	pongcount: 0,
	pongcountmutext: new Mutex(),
	initial_roomid: "", 
	latencies: [0],
	test_room_ids: [""]
}

// Now that everything is set up, start the bot. This will start the sync loop and run until killed.
client.start().then(async function() {
	console.log("Ping bot started! UserID: " + (await client.getUserId()));
});

async function handleRoomMessage(roomId: string, event: any) {
	//console.log("RoomMessage: (rid=" + roomId + "):", event);

    // Don't handle unhelpful events (ones that aren't text messages, are redacted, or sent by us)
    if (event['content']?.['msgtype'] !== 'm.text') return;
    if (event['sender'] === await client.getUserId()) return;
    
    const body = event['content']['body'];
    if (body?.startsWith("roundtrip")) {

		let number = body.split(" ")[1];
		roundtrip_testvalues.starttime = Date.now();
		roundtrip_testvalues.number = number;
		roundtrip_testvalues.latencies = [];

		let content = "rt_ping " + number + " " + Date.now();
		client.sendText(roomId, content);
	}

	if (body?.startsWith("rt_pong")) {
		let number = body.split(" ")[1];
		let timestamp = body.split(" ")[2];

		let time_diff = Date.now() - timestamp;
		roundtrip_testvalues.latencies.push(time_diff);

		if (number > 1) {
			let content = "rt_ping " + (number-1) + " " + Date.now();
			client.sendText(roomId, content);	
		} else {
			roundtrip_testvalues.endtime = Date.now();
			let content = "roundtrip test finished\n"
						+	"took " + (roundtrip_testvalues.endtime - roundtrip_testvalues.starttime) + "ms\n"
						+	"roundtrips per second: " + (roundtrip_testvalues.number / ((roundtrip_testvalues.endtime - roundtrip_testvalues.starttime)/1000) ) + "\n"
						+ 	"latencies (min,max,avg): " + JSON.stringify(minMaxAvg(roundtrip_testvalues.latencies));
			client.sendText(roomId, content);
		}
	}

	if (body?.startsWith("parallel")) {

		let number = body.split(" ")[1];
		parallel_testvalues.starttime = Date.now();
		parallel_testvalues.endtime = 0;
		parallel_testvalues.number = number;
		parallel_testvalues.pongcount = 0;

		for(let i = 0; i < number; i++) {
			let content = "par_ping " + i;
			client.sendText(roomId, content);
		}
	}

	if (body?.startsWith("par_pong")) {
		const release = await parallel_testvalues.pongcountmutext.acquire();
		parallel_testvalues.pongcount++;
		release();
		
		if(parallel_testvalues.pongcount == parallel_testvalues.number) {
			parallel_testvalues.endtime = Date.now();
			let content = "parallel test finished\n"
						+	"took " + (parallel_testvalues.endtime - parallel_testvalues.starttime) + "ms\n"
						+	"requests per second: " + (parallel_testvalues.number / ((parallel_testvalues.endtime - parallel_testvalues.starttime)/1000) ) + "";
			client.sendText(roomId, content);
		}
	}

	if(body?.startsWith("par_room_pong")) {
		if(parallel_rooms_testvalues.starttime == 0) {
			// do nothing as the start has not been started yet or it has been cancelled
			console.log("ignoring " + body);
		}
		else {
			let number = body.split(" ")[1];
			let timestamp = body.split(" ")[2];

			let time_diff = Date.now() - timestamp;

			if (number > 1) {
				let content = "par_room_ping " + (number-1) + " " + Date.now();
				client.sendText(roomId, content);	
			}
	
			const release = await parallel_rooms_testvalues.pongcountmutext.acquire();
			parallel_rooms_testvalues.pongcount++;
			parallel_rooms_testvalues.latencies.push(time_diff);
			release();
	
			if(parallel_rooms_testvalues.pongcount == parallel_rooms_testvalues.room_number * parallel_rooms_testvalues.roundrtip_number) {
				parallel_rooms_testvalues.endtime = Date.now();
				let content = "parallel rooms test finished\n"
							+   "room number: " + parallel_rooms_testvalues.room_number + "\n"
							+   "roundtrip number: " + parallel_rooms_testvalues.roundrtip_number + "\n"
							+   "total roundtrips: " + (parallel_rooms_testvalues.room_number * parallel_rooms_testvalues.roundrtip_number) + "\n"
							+	"took " + (parallel_rooms_testvalues.endtime - parallel_rooms_testvalues.starttime) + "ms\n"
							+	"roundtrips per second: " + (parallel_rooms_testvalues.room_number * parallel_rooms_testvalues.roundrtip_number / ((parallel_rooms_testvalues.endtime - parallel_rooms_testvalues.starttime)/1000) ) + "\n"
							+ 	"latencies (min,max,avg [ms]): " + JSON.stringify(minMaxAvg(parallel_rooms_testvalues.latencies));
				client.sendText(parallel_rooms_testvalues.initial_roomid, content);

				for(let room_id of parallel_rooms_testvalues.test_room_ids) {
					await client.leaveRoom(room_id);
				}
			}
		}		
	}

	if(body?.startsWith("par_rooms")) {
		let room_number = body.split(" ")[1];

		if(room_number === "stop") {
			parallel_rooms_testvalues.starttime = 0;
			let msg = "stopped parallel rooms test and ignoring further pong messages";
			console.log(msg);
			client.sendText(roomId, msg);
		}
		else {
			let roundrtip_number = body.split(" ")[2];

			parallel_rooms_testvalues.endtime = 0;
			parallel_rooms_testvalues.room_number = room_number;
			parallel_rooms_testvalues.roundrtip_number = roundrtip_number;
			parallel_rooms_testvalues.pongcount = 0;
			parallel_rooms_testvalues.initial_roomid = roomId;
			parallel_rooms_testvalues.latencies = [];
			parallel_rooms_testvalues.test_room_ids = [];
	
			let content = "Starting test - joining / creating rooms";
			client.sendText(roomId, content);

			let room_creation_promises = [];
			for(let i = 0; i < room_number; i++) {
				room_creation_promises.push(client.createRoom(
					{
						visibility: "private", 
						invite: [ pongbot_id ],
						creation_content: {
							"m.federate": false
						}
					}
				));
			}
			parallel_rooms_testvalues.test_room_ids = await Promise.all(room_creation_promises);

			// sleep for 1000ms to make sure all room creations and invites are processed
			await sleep(1000);

			parallel_rooms_testvalues.starttime = Date.now();
			
			content = "Sending messages";
			client.sendText(roomId, content);

			for(let rid of parallel_rooms_testvalues.test_room_ids) {
				let content = "par_room_ping " + roundrtip_number + " " + Date.now();
				client.sendText(rid, content);	
			}
		}		
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

	if(body?.startsWith("help")) {
		let content = "roundtrip <number> - start roundtrip test\n"
					+	"parallel <number> - start parallel test\n"
					+	"par_rooms <room_number> <roundtrip_number> - start parallel rooms test\n"
					+	"par_rooms stop - stop parallel rooms test\n"
					+	"testvalues - show current testvalues\n"
					+	"reset - leave all rooms except the one this message was sent in";
		client.sendText(roomId, content);
	}

	if(body?.startsWith("testvalues")) {
		let content = "roundtrip_testvalues: " + JSON.stringify(roundtrip_testvalues) + "\n"
					+	"parallel_testvalues: " + JSON.stringify(parallel_testvalues) + "\n"
					+	"parallel_rooms_testvalues: " + JSON.stringify(parallel_rooms_testvalues);
		client.sendText(roomId, content);
	}
    
    // Now that we've passed all the checks, we can actually act upon the command
    //await client.replyNotice(roomId, event, "Hello world!");
}

async function handleRoomEvent(roomId: string, event: any) {
	console.log("RoomEvent (rid=" + roomId + "):", event);
}

async function handleAccountData(event: any) {
	console.log("AccountData:", event);
}

async function handleRoomAccountData(roomId: string, event: any) {
	console.log("RoomAccountData: (rid=" + roomId + "):", event);
}

async function handleRoomJoin(roomId: string, event: any) {
	console.log("RoomJoin: (rid=" + roomId + "):", event);
}

async function handleRoomLeave(roomId: string, event: any) {
	console.log("RoomLeave: (rid=" + roomId + "):", event);

	if(event.content?.sender === await client.getUserId()) {
		//We left the room, so we should forget it
		await client.forgetRoom(roomId);
	}
}



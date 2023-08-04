import { 
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin
} from "matrix-bot-sdk";

import { Mutex } from "async-mutex";

const sleep = (milliseconds : number) => {
	return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function minMaxAvg(arr : number[]) {
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


const server_identifier = "matrix.camino.network";
// This will be the URL where clients can reach your homeserver. Note that this might be different
// from where the web/chat interface is hosted. The server must support password registration without
// captcha or terms of service (public servers typically won't work).
const homeserverUrl = "https://" + server_identifier;

// Use the access token you got from login or registration above.
const accessToken = "syt_Ym90dGVzdGFjY291bnQ_UVJxaUJbVFPnBpISCNNL_0KTHue";

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
	latencies: [0]
}

// Now that everything is set up, start the bot. This will start the sync loop and run until killed.
client.start().then(() => console.log("Ping bot started!"));

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
	
			let content = "Starting test - joining / creating rooms";
			client.sendText(roomId, content);
	
			// get the rooms this bot is already in
			let joined_rooms = await client.getJoinedRooms();
			console.log(joined_rooms);

			let rids = [];
	
			for(let i = 0; i < room_number; i++) {
				// create a new room if the bot is not already in a room with the same alias
				
				let alias = "#!testroom" + i + ":" + server_identifier;
				let rid = "";
				try {
					rid = (await client.lookupRoomAlias(alias)).roomId;
				}
				catch(e) {
					console.log("room alias does not exist");
				}
				
				if(rid !== "") {				
					console.log("found room with alias " + alias + " with room id: " + rid);
					if(!joined_rooms.some(room => room.includes(rid))) {
						console.log("joining room alias: " + alias);
						rid = await client.joinRoom(alias);
					}				
				}
				else {
					console.log("creating new room with alias: " + alias);
					rid = await client.createRoom({room_alias_name: "!testroom" + i, visibility: "public"});
				}
				rids.push(rid);
			}

			// invite pongbot to all rooms
			content = "Inviting pongbot to all rooms";
			client.sendText(roomId, content);

			for(let rid of rids) {
				// get room members of the room
				let pongbot_id = "@pongbot:" + server_identifier;
				let members = await client.getJoinedRoomMembers(rid);

				if( !members.some(member => member.includes(pongbot_id)) ) {
					await client.inviteUser(pongbot_id, rid);
				}				
			}

			parallel_rooms_testvalues.starttime = Date.now();

			// sleep for 1000ms to make sure all invites are processed
			await sleep(1000);
			
			content = "Sending messages";
			client.sendText(roomId, content);

			for(let rid of rids) {
				let content = "par_room_ping " + roundrtip_number + " " + Date.now();
				client.sendText(rid, content);	
			}
		}		
	}

	if(body?.startsWith("help")) {
		let content = "roundtrip <number> - start roundtrip test\n"
					+	"parallel <number> - start parallel test\n"
					+	"par_rooms <room_number> <roundtrip_number> - start parallel rooms test\n"
					+	"par_rooms stop - stop parallel rooms test\n"
					+	"testvalues - show current testvalues";
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
}



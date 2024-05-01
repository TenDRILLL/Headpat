import WebsocketEvent from "../../structs/WebsocketEvent";
import {readDatabase} from "../database";
import Server from "../../structs/Server";

export default class GetServer extends WebsocketEvent {
    constructor() {
        super("GET_SER");
    }

    async exec(event, ws, args) {
        const server = await readDatabase("servers",ws.currentServer) as Server;
        ws.send(JSON.stringify({
            opCode: "GET_SER",
            data: {
                server
            }
        }));
    }
}
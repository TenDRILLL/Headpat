import WebsocketEvent from "../../structs/WebsocketEvent";
import {getConnectionIDs} from "../connectionmanager";
import {readDatabase} from "../database";
import Server from "../../structs/Server";
import {getUser} from "../usermanager";
import Member from "../../structs/Member";

export default class GetMembers extends WebsocketEvent {
    constructor() {
        super("GET_MEM");
    }

    async exec(event, ws, args) {
        const server = await readDatabase("servers",ws.currentServer) as Server;
        const memberPromises: Promise<Member>[] = [];
        server.members.forEach(memberID => {
            memberPromises.push(getUser(memberID) as Promise<Member>);
        });
        const members = await Promise.all(memberPromises);
        const connectionIDs = getConnectionIDs();
        const memberList = members.map(x => (
            {
                user: {
                    ID: x.ID,
                    username: x.username,
                    profilePicture: x.profilePicture,
                    discriminator: x.discriminator,
                    role: x.role,
                    createdAt: x.createdAt
                },
                online: connectionIDs.includes(x.ID) ? "ONLINE" : "OFFLINE"}
        ));

        ws.send(JSON.stringify({
            opCode: "GET_MEM",
            data: {
                memberList
            }
        }));
    }
}
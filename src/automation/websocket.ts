import {WebSocketServer, WebSocket} from "ws";
import {jwtVerify} from "jose";
import {readDatabase, removeDatabase, writeDatabase} from "./database";
import Auth from "../structs/Auth";
import User from "../structs/User";
import Server from "../structs/Server";
import {getUser} from "./usermanager";
import Message from "../structs/Message";
import Channel from "../structs/Channel";
import {compare, hash} from "bcrypt";

let server;

const init = ()=>{
    server = new WebSocketServer({
        port: 5001,
        perMessageDeflate: false
    });

    const connections = new Map();

    server.on("connection", (ws, req)=>{
        ws.on("error", console.error);
        ws.on("message", (event)=>{
            if(!ws.tid) return;
            try {
                event = JSON.parse(event.toString());
            } catch(e) {
                return;
            }

            const obj = connections.get(ws.tid);
            if(!obj){
                console.log(`${ws.tid} closing WS`);
                return ws.close();
            }

            switch(event.opCode){
                case "HRT":
                    heartbeat(ws);
                    break;
                case "MSG":
                    const msg: Message = {
                        ID: "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (parseInt(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> parseInt(c) / 4).toString(16)),
                        createdAt: Date.now().toString(),
                        content: event.data.content,
                        userID: ws.tid,
                        channelID: ws.currentChannel,
                        serverID: ws.currentServer
                    };
                    sendMessage(msg).catch(e => {
                        ws.send(JSON.stringify({
                            opCode: "MSG",
                            error: e
                        }));
                    });
                    break;
                case "DEL_MSG":
                    readDatabase("messages", event.data.messageID).then((message: Message) => {
                        if(
                            message.serverID === ws.currentServer &&
                            message.channelID === ws.currentChannel &&
                            message.userID === ws.tid
                        ){
                            removeDatabase("messages",event.data.messageID).then(()=>{
                                readDatabase("channels", message.channelID).then((channel: Channel) => {
                                    const idx = channel.messages.indexOf(event.data.messageID);
                                    if(idx > -1) channel.messages.splice(idx,1);
                                    writeDatabase("channels",message.channelID,channel).then(()=>{
                                        server.clients.forEach(x => {
                                            if(x.readyState === WebSocket.OPEN && x.currentChannel === ws.currentChannel){
                                                x.send(JSON.stringify({
                                                    opCode: "DEL_MSG",
                                                    data: {
                                                        messageID: event.data.messageID
                                                    }
                                                }));
                                            }
                                        });
                                    }).catch(()=>{
                                        ws.send(JSON.stringify({
                                            opCode: "DEL_MSG",
                                            error: "Channel not found."
                                        }));
                                    });
                                }).catch(()=>{
                                    ws.send(JSON.stringify({
                                        opCode: "DEL_MSG",
                                        error: "Channel not found."
                                    }));
                                });
                            }).catch(()=>{
                                ws.send(JSON.stringify({
                                    opCode: "DEL_MSG",
                                    error: "Message not found."
                                }));
                            });
                        } else {
                            ws.send(JSON.stringify({
                                opCode: "DEL_MSG",
                                error: "Message data not a match."
                            }));
                        }
                    }).catch(()=>{
                        ws.send(JSON.stringify({
                            opCode: "DEL_MSG",
                            error: "Message data not a match."
                        }));
                    });
                case "UPD_PRF":
                    return updateProfile(event, ws);
            }
        });

        let auth = "";
        req.rawHeaders.forEach(x => {
            if(x.split("auth=").length > 1){
                auth = x.split("auth=")[1].split(";")[0];
            }
        });
        if(auth.length < 1) return ws.close();

        jwtVerify(auth, new TextEncoder().encode(process.env.JWT_SECRET as string ?? "COOLSECRET")).then(async jwtData => {
            const payload = jwtData.payload;
            if(payload.iss !== "urn:Headpat:axiom" || payload.aud !== "urn:Headpat:users") return ws.close();
            ws.tid = payload.id;
            ws.tses = payload.session;
            ws.currentServer = "0";
            ws.currentChannel = "0";
            connections.set(payload.id,{
                id: payload.id,
                session: payload.session,
                heartbeat: Date.now()
            });
            const user = await getUser(ws.tid);
            const channel = await readDatabase("channels",ws.currentChannel) as Channel;
            const server = await readDatabase("servers",ws.currentServer) as Server;
            const messagePromises: Promise<Message>[] = [];
            let messages: Message[];
            channel.messages.forEach(messageID => {
                messagePromises.push(readDatabase("messages", messageID) as Promise<Message>);
            });
            messages = await Promise.all(messagePromises);
            const userPromises: Promise<User>[] = [];
            server.members.forEach(memberID => {
                userPromises.push(getUser(memberID));
            });
            const users = await Promise.all(userPromises);
            const userList = users.map(x => ({user: x, online: connections.has(x.ID) ? "ONLINE" : "OFFLINE"}));
            ws.send(JSON.stringify({
                opCode: "ACK",
                data: {
                    user,
                    messages,
                    userList
                }
            }));
        }).catch(() => ws.close());
    });

    async function heartbeat(ws){
        //console.log(`${ws.tid} is still alive!`);
        const a = connections.get(ws.tid);
        a.heartbeat = Date.now();
        connections.set(ws.tid,a);
        const user = await getUser(ws.tid);
        const channel = await readDatabase("channels",ws.currentChannel) as Channel;
        const server = await readDatabase("servers",ws.currentServer) as Server;
        const messagePromises: Promise<Message>[] = [];
        let messages: Message[];
        channel.messages.forEach(messageID => {
            messagePromises.push(readDatabase("messages", messageID) as Promise<Message>);
        });
        messages = await Promise.all(messagePromises);
        const userPromises: Promise<User>[] = [];
        server.members.forEach(memberID => {
            userPromises.push(getUser(memberID));
        });
        const users = await Promise.all(userPromises);
        const userList = users.map(x => ({user: x, online: connections.has(x.ID) ? "ONLINE" : "OFFLINE"}));
        ws.send(JSON.stringify({
            opCode: "HRT",
            data: {
                user,
                messages,
                userList
            }
        }));
    }

    setInterval(()=>{
        connections.forEach(async x => {
            const inspect = await readDatabase("auth",x.id) as Auth;
            if(x.session !== inspect.sessionSecret || Date.now() - x.heartbeat > 1000*15){
                connections.delete(x.id);
                //console.log(`${x.id} lost connection.`);
            }
        });
    }, 30*1000);
}

async function sendMessage(message: Message){
    return new Promise(async (res, rej)=>{
        const author = await readDatabase("users",message.userID) as User;
        if(!author) rej("NO_USER");
        if(message.serverID){
            const server = await readDatabase("servers",message.serverID) as Server;
            if(!server) rej("NO_SERVER");
            if(!server.members.includes(author.ID)) rej("NOT_MEMBER");
            if(!server.channels.includes(message.channelID)) rej("NO_CHANNEL");
            const channel: Channel = await readDatabase("channels", message.channelID) as Channel;
            if(channel["messages"] === undefined) channel["messages"] = [];
            channel.messages.push(message.ID);
            await writeDatabase("messages", message.ID, message);
            await writeDatabase("channels", message.channelID, channel);
        } else {
            const recipient = await readDatabase("users", message.channelID) as User;
            if(!recipient) rej("NO_RECIPIENT");
            await writeDatabase("messages", message.ID, message);
            const recipientWebsocket = server.clients.find(x => x.tid === message.channelID);
            recipientWebsocket.send(JSON.stringify({
                opCode: "MSG",
                data: message
            }));
            return res(true);
        }

        const queue: Promise<boolean>[] = [];
        server.clients.forEach(x => {
            queue.push(new Promise(async res => {
                if(x.readyState === WebSocket.OPEN){
                    const user = await readDatabase("users",x.tid) as User;
                    if(!user) return res(false);
                    if(user.servers.includes(message.serverID)){
                        x.send(JSON.stringify({
                            opCode: "MSG",
                            data: message
                        }));
                        res(true);
                    }
                }
            }));
        });
        Promise.all(queue).then(()=>res(true));
    });
}

async function updateProfile(event, ws){
    const user = await getUser(ws.tid);
    const auth: Auth | null = await readDatabase("auth",ws.tid) as Auth;
    if(event.data.email){
        const emailRgx = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/gi;
        if(!emailRgx.test(event.data.email)) return ws.send(JSON.stringify({opCode: "UPD_PRF",error: "INVALID_EMAIL"}));
        if(event.data.email.split("@").length !== 2 || event.data.email.split("@")[1] === "localhost") return ws.send(JSON.stringify({opCode: "UPD_PRF",error: "INVALID_EMAIL"}));
        auth.email = event.data.email;
    }
    if(event.data.oldPass && event.data.newPass){
        const validPass = await compare(event.data.oldPass, auth.passHash);
        if(!validPass) return ws.send(JSON.stringify({error: "INVALID_PASSWORD"}));
        auth.passHash = await hash(event.data.newPass, 13);
    }
    if(event.data.username){
        user.username = event.data.username;
    }
    if(event.data.discriminator){
        user.discriminator = event.data.discriminator;
    }
    await writeDatabase("users", ws.tid, user);
    await writeDatabase("auth", ws.tid, auth);

    ws.send(JSON.stringify({
        opCode: "UPD_PRF",
        data: {user, email: `${auth.email.substring(0,1)}*******${auth.email.split("@")[0].substring(auth.email.split("@")[0].length-1)}@${auth.email.split("@")[1]}`}
    }))
}

export {
    init
}
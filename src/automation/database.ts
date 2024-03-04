import Keyv from "keyv";
import Server from "../structs/Server";
import User from "../structs/User";
import Channel from "../structs/Channel";
import RegCode from "../structs/RegCode";

let dbs: {[key: string]: Keyv | null} = {
    "auth": null,
    "users": null,
    "servers": null,
    "messages": null,
    "channels": null,
    "regcode": null
};

const initDatabase = async () => {
    Object.keys(dbs).forEach(key => {
        dbs[key] = new Keyv(`sqlite://${process.env.DATABASE}`, {namespace: key});
        dbs[key]!.on("error", (e)=>{
            console.log(e);
            console.log("Database error!");
        });
    });

    if(!await dbs["users"]!.has("0")){
        dbs["users"]!.set("0",{
            ID: "0",
            username: "SYSTEM",
            discriminator: "0000",
            role: "SYSTEM",
            createdAt: Date.now().toString(),
            servers: ["0"]
        } as User);
    }

    if(!await dbs["servers"]!.has("0")){
        dbs["servers"]!.set("0", {
            ID: "0",
            name: "DEV",
            userID: "0",
            channels: ["0"],
            members: ["0"]
        } as Server);
        dbs["channels"]!.set("0", {
            ID: "0",
            serverID: "0",
            messages: []
        } as Channel);
    }
    const initCode = process.env.INIT_INVITE as string;
    if(!await dbs["regcode"]!.has(initCode)){
        dbs["regcode"]!.set(initCode,{
            code: initCode,
            uses: 500,
            used: [],
            createdBy: "0"
        } as RegCode);
    }
}

const writeDatabase = (db, id, data)=>{
    //console.log(`WRITE: ${db} - ${id}`);
    return new Promise((res, rej) => {
        if(dbs[db] !== null && Object.keys(dbs).includes(db)){
            dbs[db]!.set(id, data).then(res);
        } else {
            rej("NO_DATABASE");
        }
    });
}

const readDatabase = (db, id)=>{
    //console.log(`READ: ${db} - ${id}`);
    return new Promise(async (res, rej) => {
        if(dbs[db] !== null && Object.keys(dbs).includes(db)){
            if(!await dbs[db]!.has(id)) return rej(`${db} > ${id} > NO_DATA`);
            dbs[db]!.get(id).then(data => {
                //console.log(data);
                res(data);
            });
        } else {
            rej("NO_DATABASE");
        }
    });
}

const removeDatabase = (db, id) => {
    return new Promise((res, rej)=>{
        if(dbs[db] !== null && Object.keys(dbs).includes(db)){
            dbs[db]!.delete(id).then(()=>{
                res(true);
            });
        } else {
            rej("NO_DATABASE");
        }
    });
}

const rawDatabase = (db) => {
    return dbs[db];
}

export {
    initDatabase,
    writeDatabase,
    readDatabase,
    removeDatabase,
    rawDatabase
}
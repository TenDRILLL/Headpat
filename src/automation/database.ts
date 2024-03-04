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
        //Considering moving DB to a MySQL DB, using SQLite for now.
        dbs[key] = new Keyv(`sqlite://${process.env.DATABASE}`, {namespace: key});
        dbs[key]!.on("error", (e)=>{
            console.log(e);
            console.log("Database error!");
        });
    });

    //This is done so that there's always a SYSTEM user, and the DEV server.
    //In the future it's likely that the DEV server will be removed, or repurposed. SYSTEM user will remain.
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

    //This is here so that registration is possible on a fresh installation.
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
    //Sometimes you want to be the Manager, and I can't blame you.
    return dbs[db];
}

export {
    initDatabase,
    writeDatabase,
    readDatabase,
    removeDatabase,
    rawDatabase
}
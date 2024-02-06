import Keyv from "keyv";
import Auth from "../structs/Auth";

let dbs: {[key: string]: Keyv | null} = {
    "auth": null,
    "users": null,
    "servers": null,
    "messages": null,
    "channels": null
};

const initDatabase = async () => {
    Object.keys(dbs).forEach(key => {
        dbs[key] = new Keyv(`sqlite://${process.env.DATABASE}`, {namespace: key});
        dbs[key]!.on("error", (e)=>{
            console.log(e);
            console.log("Database error!");
        });
    });
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
            if(!await dbs[db]!.has(id)) return rej("NO_DATA");
            dbs[db]!.get(id).then(data => {
                //console.log(data);
                res(data);
            });
        } else {
            rej("NO_DATABASE");
        }
    });
}

const getAuth = (email): Promise<Auth|null> => {
    return new Promise(async (res, rej)=>{
        if(dbs["auth"] === null) return rej("NO_DATABASE");
        for await (const [key, value] of dbs["auth"].iterator()) {
            if(value.email === email) return res(value as Auth);
        }
        return res(null);
    });
}

export {
    initDatabase,
    writeDatabase,
    readDatabase,
    getAuth
}
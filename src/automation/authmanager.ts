import Auth from "../structs/Auth";
import {hash} from "bcrypt";
import {randomBytes} from "crypto";
import {rawDatabase, readDatabase, writeDatabase} from "./database";

const getAuth = (email): Promise<Auth|null> => {
    return new Promise(async (res, rej)=>{
        const authDB = rawDatabase("auth");
        for await (const [key, value] of authDB!.iterator()) {
            if(value.email === email) return res(value as Auth);
        }
        return res(null);
    });
}

const getSSOAuth = (ssoID): Promise<Auth|null> => {
    return new Promise(async (res, rej)=>{
        const authDB = rawDatabase("auth");
        for await (const [key, value] of authDB!.iterator()) {
            if(value.ssoID !== undefined && value.ssoID === ssoID) return res(value as Auth);
        }
        return res(null);
    });
}

const updatePass = (id, newPass): Promise<boolean> => {
    return new Promise(async (res, rej)=>{
        const auth = await readDatabase("auth",id).catch(e => rej("NO_DATA")) as Auth;
        auth.passHash = await hash(newPass, 13);
        auth.sessionSecret = randomBytes(3).toString('hex');
        await writeDatabase("auth",id,auth);
        res(true);
    });
}

export {
    getAuth,
    updatePass,
    getSSOAuth
}
import User from "../structs/User";
import {rawDatabase, readDatabase, writeDatabase} from "./database";
import Server from "../structs/Server";

const getUser = async (id): Promise<User> => {
    return new Promise((res)=>{
        readDatabase("users",id).then(user => {
            res(user as User);
        }).catch(async (err)=>{
            //It'd only fail if the user object doesn't exist already, so we create it.
            res(await createUser(id));
        });
    });
};

const getUserCount = async (): Promise<number> =>{
    return new Promise(async res => {
        let count = -1; //Due to system account being listed as well
        for await (const [key, value] of rawDatabase("users")!.iterator()) {
            count++;
        }
        res(count);
    });
}

const createUser = async (id): Promise<User> => {
    return new Promise(async (res, rej)=>{
        const exists = await readDatabase("users", id).catch(e => console.log(e));
        if(exists !== undefined) rej("USER_EXISTS");
        const user = {
            ID: id,
            username: "Nya",
            role: "MEMBER",
            discriminator: await findFreeDiscriminator("Nya"),
            createdAt: Date.now().toString(),
            servers: ["0"]
        };
        await writeDatabase("users", id, user);
        await readDatabase("servers","0").then(async (srv: Server) => {
            srv.members.push(id);
            await writeDatabase("servers","0",srv);
        });
        res(user);
    });
};

const findFreeDiscriminator = (name) => {
    return new Promise(async res => {
        let newDisc = Math.floor(1000 + Math.random() * 9000);
        for await (const [key, value] of rawDatabase("users")!.iterator()) {
            if(value.name === name){
                if(value.discriminator === newDisc) return res(findFreeDiscriminator(name));
            }
        }
        return res(newDisc);
    });
}

export {
    getUser,
    getUserCount
}
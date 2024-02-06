import User from "../structs/User";
import {readDatabase, writeDatabase} from "./database";
import Server from "../structs/Server";

const getUser = async (id): Promise<User> => {
    return new Promise((res)=>{
        readDatabase("users",id).then(user => {
            res(user as User);
        }).catch(()=>{
            res(createUser(id));
        });
    });
};

const createUser = async (id): Promise<User> => {
    return new Promise((res, rej)=>{
        const exists = readDatabase("users", id);
        if(exists !== undefined) rej("USER_EXISTS");
        const user = {
            ID: id,
            username: "",
            role: "MEMBER",
            createdAt: Date.now().toString(),
            servers: ["0"]
        };
        writeDatabase("users", id, user);
        readDatabase("servers","0").then((srv: Server) => {
            srv.members.push(id);
            writeDatabase("servers","0",srv);
        });
        res(user);
    });
};

export {
    getUser
}
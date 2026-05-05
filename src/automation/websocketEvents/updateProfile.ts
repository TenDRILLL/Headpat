import WebsocketEvent from "../../structs/WebsocketEvent";
import {getUser} from "../usermanager";
import Auth from "../../structs/Auth";
import {readDatabase, writeDatabase} from "../database";
import {compare} from "bcrypt";
import {updatePass} from "../authmanager";
import {WebSocket} from "ws";
import Member from "../../structs/Member";
import Jimp from "jimp";

export default class UpdateProfile extends WebsocketEvent {
    constructor() {
        super("UPD_PRF");
    }

    async exec(event, ws, args) {
        const user: Member = await getUser(ws.tid);
        const auth: Auth | null = await readDatabase("auth",ws.tid) as Auth;
        if(auth.passHash && event.data.oldPass && event.data.newPass){
            const validPass = await compare(event.data.oldPass, auth.passHash);
            if(!validPass) return ws.send(JSON.stringify({error: "INVALID_PASSWORD"}));
            await updatePass(ws.tid, event.data.newPass);
        }
        await writeDatabase("auth", ws.tid, auth);

        if(event.data.username){
            user.username = event.data.username;
        }
        if(event.data.discriminator){
            user.discriminator = event.data.discriminator;
        }
        await writeDatabase("users", ws.tid, user);

        if(event.data.avatar){
            Jimp.read(Buffer.from(event.data.avatar.split(",")[1], "base64"))
                .then(async img => {
                    const sizes = [512, 256, 128, 64, 32];
                    const save: Promise<boolean>[] = [];
                    sizes.forEach(size => {
                        save.push(new Promise(async (res) => {
                            // clone() per iteration: the Jimp instance is mutated
                            // by resize(), so a shared `img` would cascade prior
                            // resizes into later ones AND race across these
                            // concurrent promises.
                            const sized = img.clone().resize(size, size);
                            await sized.writeAsync(`${__dirname}/../../${process.env.MEMBER_ASSET_LOCATION}/${user.ID[0]}/${user.ID}-avatar-${size}.png`);
                            res(true);
                        }));
                    });
                    await Promise.all(save);
                }).catch(e => console.error(e));
        }
        if(event.data.banner){
            Jimp.read(Buffer.from(event.data.banner.split(",")[1], "base64"))
                .then(async img => {
                    img.resize(340, 120);
                    await img.writeAsync(`${__dirname}/../../${process.env.MEMBER_ASSET_LOCATION}/${user.ID[0]}/${user.ID}-banner.png`);
                }).catch(e => console.error(e));
        }

        ws.send(JSON.stringify({
            opCode: "UPD_PRF",
            data: {
                user,
                online: "ONLINE"
            }
        }));

        const queue: Promise<boolean>[] = [];
        args.server.clients.forEach(x => {
            queue.push(new Promise(async res => {
                if(x.readyState === WebSocket.OPEN){
                    x.send(JSON.stringify({
                        opCode: "UPD_MEM",
                        data: {
                            user,
                            online: "ONLINE"
                        }
                    }));
                    res(true);
                }
            }));
        });
        Promise.all(queue);
    }
}

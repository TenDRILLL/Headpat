import {Router} from "express";
import {readDatabase, writeDatabase} from "../automation/database";
import {getAuth} from "../automation/authmanager";
import {hash} from "bcrypt";
import {randomBytes} from "crypto";
import RegCode from "../structs/RegCode";

const registerRouter = Router();

registerRouter.get("/", (req, res)=>{
    if(req.cookies.auth) return res.redirect("/app");
    res.render("register.ejs", {});
});

registerRouter.post("/", async (req, res)=>{
    const emailRgx = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/gi;
    if(!emailRgx.test(req.body.email)) return res.json({error: "INVALID_EMAIL"});
    if(req.body.email.split("@").length !== 2 || req.body.email.split("@")[1] === "localhost") return res.json({error: "INVALID_EMAIL"});

    //This is only temp, registrationCode might be removed from final product, or not.
    const regCode: RegCode = await readDatabase("regcode",req.body.registrationCode.toUpperCase()).catch(e => {
        return res.json({error: "INVALID_REGCODE"});
    }) as RegCode;
    if(regCode.uses !== 0){
        regCode.uses -= 1;
    } else {
        return res.json({error: "USED_REGCODE"});
    }

    const auth = await getAuth(req.body.email);
    if(auth !== null) return res.json({error: "EMAIL_USED"});
    const passHash = await hash(req.body.password, 13);
    const ID = "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (parseInt(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> parseInt(c) / 4).toString(16));
    await writeDatabase(
        "auth",
        ID,
        {
            ID,
            email: req.body.email,
            passHash,
            tfaSecret: "",
            sessionSecret: randomBytes(3).toString('hex')
        }
    );
    res.json({redirect: "/login"});
});

export default registerRouter;
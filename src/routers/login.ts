import {Router} from "express";
import {SignJWT} from "jose";
import {getAuth} from "../automation/authmanager";
import {compare} from "bcrypt";
import {verifyTOTP} from "../automation/totp";

const loginRouter = Router();

loginRouter.get("/", (req, res)=>{
    if(req.cookies.auth) return res.redirect("/app");
    res.render("login.ejs", {domain: `${req.protocol}://${req.get("host")}/oauth/discord`});
});

loginRouter.post("/", async (req, res)=>{
    const auth = await getAuth(req.body.email);
    if(auth === null) return res.json({error: "INVALID_CREDENTIALS"});

    const validPass = await compare(req.body.password, auth.passHash!);
    if(!validPass) return res.json({error: "INVALID_CREDENTIALS"});

    if(auth.tfaSecret !== "" && !req.body.tfa) return res.json({data: "2FA_REQUIRED"});
    if(auth.tfaSecret !== "" && !verifyTOTP(auth.tfaSecret, req.body.tfa)) return res.json({error: "INVALID_2FA"});

    const jwt = await new SignJWT(
        {
            id: auth.ID,
            session: auth.sessionSecret
        })
        .setProtectedHeader({alg: "HS256"})
        .setIssuedAt()
        .setIssuer("urn:Headpat:axiom")
        .setAudience("urn:Headpat:users")
        .sign(new TextEncoder().encode(process.env.JWT_SECRET as string));
    if(req.body.remember){
        return res.cookie("auth",jwt, {maxAge: 1000*60*60*24*30}).json({redirect: "/app"});
    }
    res.cookie("auth",jwt).json({redirect: "/app"});
});

export default loginRouter;
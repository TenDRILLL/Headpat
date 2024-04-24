import {Router} from "express";
import {getSSOAuth} from "../automation/authmanager";
import {writeDatabase} from "../automation/database";
import {randomBytes} from "crypto";
import {SignJWT} from "jose";

const oauthRouter = Router();

oauthRouter.get("/discord", async (req, res)=>{
    const data = new URLSearchParams();
    data.append("client_id",process.env.DISCORD_ID as string);
    data.append("client_secret",process.env.DISCORD_SECRET as string);
    data.append("grant_type","authorization_code");
    data.append("code",req.query.code as string);
    data.append("redirect_uri",`${req.protocol}://${req.get("host")}/oauth/discord`);

    fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {"Content-Type":"application/x-www-form-urlencoded"},
        body: data
    }).then(x => x.json()).then(x => {
        if(x.access_token === undefined) {
            console.log("NO TOKEN!");
            return res.redirect("/login");
        }
        fetch("https://discord.com/api/users/@me", {
            headers: {"authorization": `${x.token_type} ${x.access_token}`}
        }).then(y => y.json()).then(async y => {
            if(y.id === undefined) {
                console.log("NO UID!");
                return res.redirect("/login");
            }
            let auth = await getSSOAuth(y.id);
            if(auth === null) {
                const ID = "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (parseInt(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> parseInt(c) / 4).toString(16));
                auth = {
                    ID,
                    ssoID: y.id,
                    sessionSecret: randomBytes(3).toString("hex"),
                    tfaSecret: ""
                };
                await writeDatabase("auth", ID, auth);
            }
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
            res.cookie("auth",jwt).redirect("/app");
        });
    });
});

class Tokens {
    access_token: string;
    expires_in: number;
    expires_at?: number;
    refresh_token: string;
    scope: string;
    token_type: string;
    id_token?: string;
}

export class dcuser {
    id: string;
    username: string;
    avatar: string;
    avatar_decoration: string;
    discriminator: string;
    public_flags: number;
    flags: number;
    banner: string;
    banner_color: string;
    accent_color: number;
    locale: string;
    mfa_enabled: boolean;
    premium_type: number;
}

export default oauthRouter;
import {Router} from "express";
import {readdirSync} from "fs";
import {readDatabase} from "../automation/database";

const resourceRouter = Router();

resourceRouter.get("/user/:userId", async (req, res)=>{
    if (req.query.size && !["32", "64", "128", "256", "512"].includes(req.query.size as string)) return res.sendFile("TMPx128.png", {root: `${__dirname}/../html/styles/`})
    return res.sendFile(`TMPx${req.query.size || 128}.png`, {root: `${__dirname}/../html/styles/`});
    //This isn't implemented yet. Just thoughts
    /*if(req.params.userId === undefined){
        return res.status(400);
    }
    //Upcoming: get user pfp from datastring from db
    readDatabase("users", req.params.userId).then(user => {

    }).catch(e => res.sendFile(""));*/
});

resourceRouter.get("/:resourceName", (req, res)=>{
    if(req.params.resourceName === undefined){
        return res.status(400);
    }
    const styles = readdirSync("./html/styles");
    const scripts = readdirSync("./html/scripts");
    if(styles.includes(req.params.resourceName)){
        res.sendFile(req.params.resourceName, {root: `${__dirname}/../html/styles/`});
    } else if (scripts.includes(req.params.resourceName)) {
        res.sendFile(req.params.resourceName, {root: `${__dirname}/../html/scripts/`});
    } else {
        return res.status(404);
    }
});

export default resourceRouter;
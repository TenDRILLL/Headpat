import {Router} from "express";
import {readdirSync, access as check} from "fs";


const resourceRouter = Router();

resourceRouter.get("/user/:userId/:asset", async (req, res)=>{
    if(req.params.userId === undefined || req.params.asset === undefined){
        return res.status(400);
    }

    const rex = /[a-z0-9-]/gi;
    if(!rex.test(req.params.userId) || !rex.test(req.params.asset)) return res.status(400);

    if(req.query.size && !["32", "64", "128", "256", "512"].includes(req.query.size as string)) req.query.size = "128";
    const file = `${req.params.userId[0]}/${req.params.userId}-${req.params.asset}${req.query.size === undefined ? "":`-${req.query.size}`}.png`;
    const path = `${__dirname}/../${process.env.MEMBER_ASSET_LOCATION}/`;
    const placeholder = `0/0-${req.params.asset}${req.query.size === undefined ? "":`-${req.query.size}`}.png`;
    check(`${path}${file}`, function(err) {
        if (err === null) {
            return res.sendFile(file, {root: path});
        } else {
            check(`${path}${placeholder}`, function(err) {
                if (err === null) {
                    return res.sendFile(placeholder, {root: path});
                } else {
                    return res.status(404);
                }
            });
        }
    });
});

resourceRouter.get("/:resourceName", (req, res)=>{
    if(req.params.resourceName === undefined){
        return res.status(400);
    }
    const styles = readdirSync("./html/styles");
    const scripts = readdirSync("./html/scripts");
    const assets = readdirSync("./html/assets");
    if(styles.includes(req.params.resourceName)){
        res.sendFile(req.params.resourceName, {root: `${__dirname}/../html/styles/`});
    } else if (scripts.includes(req.params.resourceName)) {
        res.sendFile(req.params.resourceName, {root: `${__dirname}/../html/scripts/`});
    } else if (assets.includes(req.params.resourceName)) {
        res.sendFile(req.params.resourceName, {root: `${__dirname}/../html/assets/`});
    } else {
        return res.status(404);
    }
});

export default resourceRouter;
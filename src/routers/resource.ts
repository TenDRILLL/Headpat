import {Router} from "express";
import {readdirSync, access as check} from "fs";


const resourceRouter = Router();

resourceRouter.get("/user/:userId/:asset", async (req, res)=>{
    if(req.params.userId === undefined || req.params.asset === undefined){
        return res.status(400);
    }

    // Anchored validation prevents path traversal. An unanchored regex
    // returns true if any substring matches (e.g. /[a-z0-9-]/.test("../etc")
    // is true). A `g` flag would also make RegExp.test stateful across
    // calls on the same instance, producing flaky 400s for legitimate IDs.
    const isValidParam = /^[a-z0-9-]{1,64}$/;
    if(!isValidParam.test(req.params.userId) || !isValidParam.test(req.params.asset)){
        return res.status(400).end();
    }

    if(req.query.size && !["32", "64", "128", "256", "512"].includes(req.query.size as string)) req.query.size = "128";
    const file = `${req.params.userId[0]}/${req.params.userId}-${req.params.asset}${req.query.size === undefined ? "":`-${req.query.size}`}.png`;
    const path = `${__dirname}/../${process.env.MEMBER_ASSET_LOCATION}/`;
    const placeholder = `0/0-${req.params.asset}${req.query.size === undefined ? "":`-${req.query.size}`}.png`;
    const cacheHeaders = {"Cache-Control": "public, max-age=300, must-revalidate"};
    check(`${path}${file}`, function(err) {
        if (err === null) {
            return res.sendFile(file, {root: path, headers: cacheHeaders});
        } else {
            check(`${path}${placeholder}`, function(err) {
                if (err === null) {
                    return res.sendFile(placeholder, {root: path, headers: cacheHeaders});
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
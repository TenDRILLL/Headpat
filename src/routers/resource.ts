import {Router} from "express";
import {readdirSync} from "fs";

const resourceRouter = Router();

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
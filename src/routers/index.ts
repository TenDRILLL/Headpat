import {Router} from "express";
import {getUserCount} from "../automation/usermanager";


const indexRouter = Router();

indexRouter.get("/", async (req, res)=>{
    const users = await getUserCount();
    res.render("index.ejs",{users});
});

export default indexRouter;
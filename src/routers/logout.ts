import {Router} from "express";

const logoutRouter = Router();

logoutRouter.get("/", (req, res)=>{
    res.clearCookie("auth").redirect("/login");
});

export default logoutRouter;
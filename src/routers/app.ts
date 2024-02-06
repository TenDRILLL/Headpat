import {Router} from "express";

const appRouter = Router();

appRouter.get("/", (req, res)=>{
    if(!req.cookies.auth) return res.redirect("/login");
    res.render("app.ejs");
});

export default appRouter;
import "dotenv/config";
/* ------------- APP_SERVER ------------- */
import express from "express";
import cookieParser from "cookie-parser";

const app = express();
const port: number = parseInt(process.env.PORT as string) ?? 5000;

app.set("view engine", "ejs");
app.set("views", "./html/pages");
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

/* ------------- ROUTERS ------------- */

import loginRouter from "./routers/login";
import resourceRouter from "./routers/resource";
import registerRouter from "./routers/register";
import appRouter from "./routers/app";
import logoutRouter from "./routers/logout";
app.use("/login", loginRouter);
app.use("/resource", resourceRouter);
app.use("/register", registerRouter);
app.use("/app", appRouter);
app.use("/logout", logoutRouter);
app.get("/", (req, res)=>{
    res.render("index.ejs");
});

/* ------------- DATABASE ------------- */

import {initDatabase} from "./automation/database";

initDatabase();

/* ------------- WEBSOCKET ------------- */
import {init} from "./automation/websocket";
init();

/* ------------- START ------------- */

app.listen(port, ()=>{
    console.log(`Running...
Running at: http://localhost:${port}`);
});

process.on("uncaughtException", (e)=>{
    console.log(`Exception; ${e}`);
});
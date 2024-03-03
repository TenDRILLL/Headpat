const wsURL = "wss://headpat.tentti.xyz/ws";
let ws = new WebSocket(wsURL);
ws.onopen = onOpen;
ws.onmessage = onMessage;
ws.onclose = onClose;
ws.onerror = onError;
let heart;
let version;

let userStore = {};

const closeDanger = document.getElementById("close-danger");
const messageField = document.getElementById("messageField");
const messageContainer = document.getElementById("messageContainer");
const userContainer = document.getElementById("userContainer");

function onOpen(){
    ws.send("");
    heart = setInterval(sendHeartbeat, 5000);
}

function onMessage(event){
    let eventData;
    try{
        eventData = JSON.parse(event.data);
    } catch(e){
        return;
    }
    console.log(eventData);
    switch(eventData.opCode){
        case "MSG":
            if(eventData.error) return console.error(eventData.error);
            messageContainer.innerHTML += `<div class="message">
<pre>
${userStore[eventData.data.userID]?.username ?? eventData.data.userID}・${parseTimestamp(eventData.data.createdAt)}
${linkifyHtml(eventData.data.content, {target: "_blank"})}
</pre></div>`;
            messageContainer.scrollTop = messageContainer.scrollHeight;
            break;
        case "ACK":
            hideToast();
            clearTimeout(heart);
            heart = setInterval(sendHeartbeat, 5000);
            version = eventData.data.version;
        case "HRT":
            if(eventData.data.version !== version){
                showToast("Version out of date, reloading in 5 seconds...");
                return setTimeout(location.reload, 5000);
            }
            if(eventData.data.userList){
                userContainer.innerHTML = "";
                eventData.data.userList
                    .sort((a,b) => {
                        const x = ["ONLINE","OFFLINE"];
                        return x.indexOf(a.online) - x.indexOf(b.online);
                    })
                    .forEach(entry => {
                    userStore[entry.user.ID] = entry.user;
                    userContainer.innerHTML += `<div class="user ${entry.online}" id="${entry.user.ID}">${entry.user.username}</div>`;
                });
            }
            if(eventData.data.messages){
                messageContainer.innerHTML = eventData.data.messages.map(msg => `<div class="message" id="${msg.ID}">
<pre>
${userStore[msg.userID]?.username ?? msg.userID}・${parseTimestamp(msg.createdAt)}
${linkifyHtml(msg.content, {target: "_blank"})}
</pre></div>`).join("");
                eventData.data.messages.map(msg => {
                    const htmlMsg = document.getElementById(msg.ID);
                    htmlMsg.addEventListener("contextmenu",function(event){
                        event.preventDefault();
                        const ctxMenu = document.getElementById("messageCtx");
                        if(ctxMenu["data-messageID"] === msg.ID){
                            ctxMenu.style.display = "";
                            ctxMenu.style.left = "";
                            ctxMenu.style.top = "";
                            ctxMenu["data-messageID"] = "";
                            return;
                        }
                        ctxMenu.style.display = "block";
                        ctxMenu.style.left = (event.pageX - 10)+"px";
                        ctxMenu.style.top = (event.pageY - 10)+"px";
                        ctxMenu["data-messageID"] = msg.ID;
                    },false);
                });
            }
            break;
        case "DEL_MSG":
            if("messageID" in eventData.data){
                document.getElementById(eventData.data.messageID).remove();
            }
        case "UPD_PRF":
            document.getElementById("user-profile").style.setProperty("display", "none", "important");

            document.getElementById("username").value = eventData.data.user.username ?? "";
            document.getElementById("discriminator").value = eventData.data.user.discriminator ?? "";
            document.getElementById("email").placeholder = eventData.data.email ?? "";
    }
}

function parseTimestamp(timestamp){
    const msgTime = new Date(parseInt(timestamp));
    const now = new Date();
    const clock = `${msgTime.getHours().toString().padStart(2,"0")}:${msgTime.getMinutes().toString().padStart(2,"0")}`;
    const calendar = `${msgTime.getDate().toString().padStart(2,"0")}/${msgTime.getMonth().toString().padStart(2,"0")}/${msgTime.getFullYear()}`;
    if(now.getTime() - msgTime.getTime() < 1000*60*60*24 && now.getDate() === msgTime.getDate()){
        return `Today at ${clock}`;
    } else if(now.getTime() - msgTime.getTime() < 1000*60*60*24*2 && now.getDate() !== msgTime.getDate()){
        return `Yesterday at ${clock}`;
    } else {
        return `${calendar} ${clock}`;
    }
}

const toast = document.getElementById("snackbar");
function showToast(msg, load, time){
    toast.className = "show";
    toast.innerHTML = msg;
    if(time !== undefined && time !== null){setTimeout(()=>{toast.className = toast.className.replace("show", "");}, time*1000);}
    if(load !== undefined && load !== null){ toast.innerHTML = `<p>${msg}</p>
    <div id="dot-spin" class="dot-spin"></div>` }
}
function hideToast(){
    toast.className = "";
}

document.addEventListener("click",function(event){
    const ctxMenu = document.getElementById("messageCtx");
    ctxMenu.style.display = "";
    ctxMenu.style.left = "";
    ctxMenu.style.top = "";
    ctxMenu["data-messageID"] = "";
},false);

function onClose(){
    console.log("Closing connection.");
    ws.close();
    clearInterval(heart);
    showToast("Connection Lost, reconnecting...", true);
    setTimeout(reconnect, 5000);
}

function onError(e){
    console.log(`E:${JSON.stringify(e)}`);
    ws.close();
}

function sendHeartbeat(){
    ws.send(JSON.stringify({
        opCode: "HRT",
    }));
}

function reconnect() {
    console.log("Attempting reconnection to WS");
    ws = new WebSocket(wsURL);
    ws.onopen = onOpen;
    ws.onmessage = onMessage;
    ws.onclose = onClose;
    ws.onerror = onError;
}

closeDanger.onclick = () => {
    document.getElementById("dangerNotice").remove();
};

messageField.addEventListener("keydown", (e)=>{
    if(e.key === "Enter" && messageField.value.trim().length > 0){
        ws.send(JSON.stringify({
            opCode: "MSG",
            data: {
                content: messageField.value
            }
        }));
        messageField.value = "";
    }
});

/*
<div class="user">User1</div>
<div class="message">User1: Hello!</div>
<div class="channel">Channel 1</div>
*/

function deleteMessage(){
    const ctxMenu = document.getElementById("messageCtx");
    if(ctxMenu["data-messageID"] === undefined || ctxMenu["data-messageID"] === "") return;
    ws.send(JSON.stringify({
        opCode: "DEL_MSG",
        data: {
            messageID: ctxMenu["data-messageID"]
        }
    }))
}
document.getElementById("user-profile").style.setProperty("display", "none", "important");
document.getElementById("profile_popup").onclick = ()=>{
    document.getElementById("user-profile").style.setProperty("display", "flex", "important");
}

document.getElementById("close-profile").onclick = ()=>{
    document.getElementById("user-profile").style.setProperty("display", "none", "important");
}

document.getElementById("profile_picture").onclick = ()=>{
    alert("Change PFP is a Work-In-Progress");
}

document.getElementById("save_profile").onclick = ()=>{
    //const profilePicture = document.getElementById("profile-picture").innerHTML or smth;
    const username = document.getElementById("username").value;
    const discriminator = document.getElementById("discriminator").value;
    const email = document.getElementById("email").value;
    const oldPass = document.getElementById("old_password").value;
    const newPass = document.getElementById("new_password").value;
    const data = {};
    if(username.length > 0) data["username"] = username;
    if(discriminator.length > 0) data["discriminator"] = discriminator;
    if(email.length > 0) data["email"] = email;
    if(newPass.length > 0){
        if(oldPass.length > 0){
            //Complain to user.
        } else {
            data["oldPass"] = oldPass;
            data["newPass"] = newPass;
        }
    }
    ws.send(JSON.stringify({
        opCode: "UPD_PRF",
        data
    }));
}


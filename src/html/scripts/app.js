const wsURL = `ws${location.host.startsWith("localhost")?"":"s"}://${location.host}`;
let ws = new WebSocket(wsURL);
ws.onopen = onOpen;
ws.onmessage = onMessage;
ws.onclose = onClose;
ws.onerror = onError;
let heart, memb, currentUser;
let version = "";

let userStore = {};

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const closeDanger = document.getElementById("closeDanger");
const messageField = document.getElementById("messageField");
const mobileSend = document.getElementById("mobileSend");
const messageFieldPlaceholder = document.getElementById('messageFieldPlaceholder');
const messageContainer = document.getElementById("messageContainer");
const userContainer = document.getElementById("userList");
const userProfile = document.getElementById("user");

const messageObserver = new MutationObserver((mut) => {
    if(mut[0].oldValue === "false") {
        moveChat();
        messageObserver.disconnect();
    }
});

messageObserver.observe(messageContainer, {
    subtree: true,
    attributeFilter: ["loaded"],
    attributeOldValue: true,
});

function onOpen(){
    ws.send("");
    heart = setInterval(sendHeartbeat, 5000);
    memb = setInterval(getMembers,20*1000);
}

function onMessage(event){
    let eventData;
    try{
        eventData = JSON.parse(event.data);
    } catch(e){
        return;
    }
    //console.log(eventData);
    switch(eventData.opCode){
        case "MSG":
            message(eventData);
            break;
        case "ACK":
            hideToast();
            clearTimeout(heart);
            clearTimeout(memb);
            heart = setInterval(sendHeartbeat, 5000);
            memb = setInterval(getMembers,20*1000);
            currentUser = eventData.data.user;
            if(version === "") {version = eventData.data.version;}
            userProfile.innerHTML = `<img style="float: left; border-radius: 50%;" src="/resource/user/${eventData.data.user.ID}" loading="lazy" width="48" height="48" decoding="async" data-nimg="1" style="color: transparent;">
<h2 style="float: left;" className="no-select">${eventData.data.user.username}#${eventData.data.user.discriminator??"0"}</h2>`;
            ws.send(JSON.stringify({opCode: "GET_MEM"}));
            //Intentional fallthrough.
        case "HRT":
            if(eventData.data.version !== version){
                showToast("Version out of date, reloading in 5 seconds...");
                return setTimeout(()=>{
                    location.reload();
                }, 5000);
            }
            break;
        case "GET_MEM":
            userContainer.innerHTML = "";
            eventData.data.memberList
                .sort((a,b) => {
                    const x = ["ONLINE","OFFLINE"];
                    return x.indexOf(a.online) - x.indexOf(b.online);
                })
                .forEach(entry => {
                    userStore[entry.user.ID] = entry.user;
                    userContainer.innerHTML += `<div class="user ${entry.online}" id="${entry.user.ID}">${entry.user.username}</div>`;
                });
            ws.send(JSON.stringify({opCode: "GET_MSG"}));
            break;
        case "GET_MSG":
            messageContainer.innerHTML = eventData.data.messages.map(msg => `<div class="message" id="${msg.ID}">
<pre>
${userStore[msg.userID]?.username ?? msg.userID}・${parseTimestamp(msg.createdAt)}
${DOMPurify.sanitize(linkifyHtml(msg.content, {target: "_blank"}),{ ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['target','href'] })}
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
            messageContainer.setAttribute("loaded", "true");
            break;
        case "DEL_MSG":
            if("messageID" in eventData.data){
                document.getElementById(eventData.data.messageID).remove();
            }
            break;
        case "UPD_PRF":
            document.getElementById("userProfile").style.setProperty("display", "none", "important");

            document.getElementById("username").value = eventData.data.user.username ?? "";
            document.getElementById("discriminator").value = eventData.data.user.discriminator ?? "";
            userProfile.innerHTML = `<img style="float: left; border-radius: 50%;" src="/resource/user/${eventData.data.user.ID}" loading="lazy" width="48" height="48" decoding="async" data-nimg="1" style="color: transparent;">
<h2 style="float: left;" className="no-select">${eventData.data.user.username}#${eventData.data.user.discriminator??"0"}</h2>`;
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

function message(eventData){
    if(eventData.error) return console.error(eventData.error);
    messageContainer.innerHTML += `<div class="message">
<pre>
${userStore[eventData.data.userID]?.username ?? eventData.data.userID}・${parseTimestamp(eventData.data.createdAt)}
${DOMPurify.sanitize(linkifyHtml(eventData.data.content, {target: "_blank"}),{ ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['target','href'] })}
</pre></div>`;
    moveChat(eventData.data.userID);
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

document.addEventListener("click",function(){
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
    clearInterval(memb);
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

function getMembers(){
    ws.send(JSON.stringify({
        opCode: "GET_MEM",
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

if(localStorage.getItem("notice") === "true"){
    document.getElementById("dangerNotice").remove();
}

closeDanger.onclick = () => {
    document.getElementById("dangerNotice").remove();
    localStorage.setItem("notice", "true");
};

function sendMessage(message) {
    if(message.length < 1) {
        return showToast("Message cannot be empty.", undefined, 5);
    }
    ws.send(JSON.stringify({
        opCode: "MSG",
        data: {
            content: message
        }
    }));
    messageField.innerText = "";
}

let keyMap = {}; //A map for what keys are currently pressed for messageField
messageField.onkeydown = messageField.onkeyup = function(e){
    keyMap[e.key] = e.type == 'keydown';
    if(keyMap["Enter"] && !keyMap["Shift"] && !isMobile) {
        e.preventDefault();
        sendMessage(messageField.innerText.replace(/^\s+|\s+$/g, ""));
    }
    if (!isMobile) return;
    if (messageField.innerText.replace(/^\s+|\s+$/g, "").length > 0) {
        messageFieldPlaceholder.style.display = "none";
    } else {
        messageFieldPlaceholder.style.display = "block";
    }
}

const leftContainer = document.getElementById("leftContainer");
const rightContainer = document.getElementById("rightContainer");
const leftToggle = document.getElementById("serverChannelListToggle");

if (isMobile) {
    document.body.style.minHeight = "100%";
    leftContainer.style.display = "none";
    userContainer.style.display = "none";
    leftToggle.style.display = "block";
    mobileSend.style.display = "block";
    mobileSend.addEventListener("click", () => {
        messageFieldPlaceholder.style.display = "block";
        sendMessage(messageField.innerText.replace(/^\s+|\s+$/g, ""));
    });
    leftToggle.addEventListener("click", () => {
        if (leftContainer.style.display === "none" || !leftContainer.style.display) {
            leftContainer.style.display = "flex";
            rightContainer.style.display = "none";
        } else {
            leftContainer.style.display = "none";
            rightContainer.style.display = "flex";
        }
        
    });
}

document.getElementById("userListToggle").addEventListener("click", () => {
    if (userContainer.style.display === "block" || !userContainer.style.display) {
        if (isMobile) {
            document.getElementById("messages").style.display = "flex";
        }
        userContainer.style.display = "none";
    } else {
        if (isMobile) {
            document.getElementById("messages").style.display = "none";
        }
        userContainer.style.display = "block";
    }
});

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

document.getElementById("logoutButton").onclick = () =>{
    location.href = "/logout";
};

document.getElementById("userProfile").style.setProperty("display", "none", "important");
document.getElementById("user").onclick = ()=>{
    document.getElementById("userProfile").style.setProperty("display", "flex", "important");
}

document.getElementById("closeProfile").onclick = ()=>{
    document.getElementById("userProfile").style.setProperty("display", "none", "important");
}

document.getElementById("profilePicture").onclick = ()=>{
    alert("Change PFP is a Work-In-Progress");

}

document.getElementById("saveProfile").onclick = ()=>{
    //const profilePicture = document.getElementById("profilePicture").innerHTML or smth idk yet
    const username = document.getElementById("username").value;
    const discriminator = document.getElementById("discriminator").value;
    const oldPass = document.getElementById("oldPassword").value;
    const newPass = document.getElementById("newPassword").value;
    const data = {};
    if(username.length > 0) data["username"] = username;
    if(discriminator.length > 0) data["discriminator"] = discriminator;
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

function moveChat(user){
    if (!user) return messageContainer.scrollTop = messageContainer.scrollHeight;
    if (user === currentUser.ID) messageContainer.scrollTop = messageContainer.scrollHeight;
    else if (messageContainer.scrollTop + messageContainer.clientHeight + 100 > messageContainer.scrollHeight) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
}

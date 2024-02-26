let ws = new WebSocket("ws://192.168.0.158:5001");
const heart = setInterval(sendHeartbeat, 5000);
let recon;

const closeDanger = document.getElementById("close-danger");
const messageField = document.getElementById("messageField");
const messageContainer = document.getElementById("messageContainer");
const userContainer = document.getElementById("userContainer");

function onOpen(){
    ws.send("");
    clearInterval(recon);
}

function onMessage(event){
    clearInterval(recon);
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
${eventData.data.userID}・${new Date(parseInt(eventData.data.createdAt)).toLocaleString()}
${eventData.data.content}
</pre></div>`;
            messageContainer.scrollTop = messageContainer.scrollHeight;
            break;
        case "HRT":
        case "ACK":
            if(eventData.data.messages){
                messageContainer.innerHTML = eventData.data.messages.map(msg => `<div class="message" id="${msg.ID}">
<pre>
${msg.userID}・${new Date(parseInt(msg.createdAt)).toLocaleString()}
${msg.content}
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
            if(eventData.data.userList){
                userContainer.innerHTML = eventData.data.userList.map(usr => `<div class="user ${usr.online}">${usr.ID}</div>`).join("");
            }
            break;
        case "DEL_MSG":
            if("messageID" in eventData.data){
                document.getElementById(eventData.data.messageID).remove();
            }
    }
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
    recon = setInterval(reconnect, 5000);
}

ws.onopen = onOpen;
ws.onmessage = onMessage;
ws.onclose = onClose;

function sendHeartbeat(){
    ws.send(JSON.stringify({
        opCode: "HRT",
    }));
}

function reconnect() {
    console.log("Attempting reconnection to WS");
    ws = new WebSocket("ws://localhost:5001");
    ws.onopen = onOpen;
    ws.onmessage = onMessage;
    ws.onclose = onClose;
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
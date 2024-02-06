let ws = new WebSocket("ws://localhost:5001");
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
    let data;
    try{
        data = JSON.parse(event.data);
    } catch(e){
        return;
    }
    console.log(data);
    switch(data.opCode){
        case "MSG":
            if(data.error) return console.error(data.error);
            messageContainer.innerHTML += `<div class="message">
<pre>
${data.data.userID}・${new Date(parseInt(data.data.createdAt)).toLocaleString()}
${data.data.content}
</pre></div>`;
            messageContainer.scrollTop = messageContainer.scrollHeight;
            break;
        case "HRT":
        case "ACK":
            if(data.data.messages){
                messageContainer.innerHTML = data.data.messages.map(msg => `<div class="message">
<pre>
${msg.userID}・${new Date(parseInt(msg.createdAt)).toLocaleString()}
${msg.content}
</pre></div>`).join("");
            }
            if(data.data.userList){
                userContainer.innerHTML = data.data.userList.map(usr => `<div class="user ${usr.online}">${usr.ID}</div>`).join("");
            }
            break;
    }
}

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
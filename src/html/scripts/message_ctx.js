function openMessageContext(event, element) {
    if (event.target.id.includes('message') || event.target.id.includes('mention')) return;
    closePopup();
    closeUserContextMenu();
    const ctxMenu = document.getElementById("messageCtx");
    if(ctxMenu["data-messageID"] === element.id){
        ctxMenu.style = "";
        ctxMenu["data-messageID"] = "";
        return;
    }
    document.querySelectorAll('[css-active="true"]').forEach((e) => e.setAttribute('css-active', 'false'));
    element.setAttribute('css-active', 'true');
    if (element.children[0].getAttribute('data-user') !== currentUser.ID) document.getElementById('messageCtxDeleteMessage').style.display = "none";
    else document.getElementById('messageCtxDeleteMessage').style.display = "flex";
    ctxMenu.style.display = "block";
    ctxMenu.style.left = event.pageX + "px";
    ctxMenu.style.top = event.pageY + "px";
    if (+ctxMenu.style.top.replace('px', '') + ctxMenu.clientHeight + 10 > document.body.clientHeight) ctxMenu.style.top = document.body.clientHeight - ctxMenu.clientHeight - 10  + "px";
    ctxMenu["data-messageID"] = element.id;
}

function closeMessageContextMenu() {
    const ctxMenu = document.getElementById("messageCtx");
    document.querySelectorAll('[css-active="true"]').forEach((e) => e.setAttribute('css-active', 'false'));
    ctxMenu.style = "";
    ctxMenu["data-messageID"] = "";
}

function deleteMessage() {
    const ctxMenu = document.getElementById("messageCtx");
    if(ctxMenu["data-messageID"] === undefined || ctxMenu["data-messageID"] === "") return;
    ws.send(JSON.stringify({
        opCode: "DEL_MSG",
        data: {
            messageID: ctxMenu["data-messageID"]
        }
    }))
}

function copyMessage(idOnly) {
    const ctxMenu = document.getElementById("messageCtx");
    if(ctxMenu["data-messageID"] === undefined || ctxMenu["data-messageID"] === "") return;
    if (idOnly) return navigator.clipboard.writeText(ctxMenu["data-messageID"]);
    navigator.clipboard.writeText(document.getElementById(ctxMenu["data-messageID"]).children[2].children[2]?.innerText ?? document.getElementById(ctxMenu["data-messageID"]).children[2].children[0].innerText);
}
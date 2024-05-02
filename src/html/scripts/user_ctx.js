function openUserContext(event, element) {
    closePopup();
    closeMessageContextMenu();
    const ctxMenu = document.getElementById("userCtx");
    if(ctxMenu["data-opener"] === element.id) {
        ctxMenu.style = "";
        ctxMenu["data-userID"] = "";
        ctxMenu["data-opener"] = "";
        return;
    }
    document.querySelectorAll('[css-active="true"]').forEach((e) => e.setAttribute('css-active', 'false'));
    element.setAttribute('css-active', 'true');
    ctxMenu.style.display = "block";
    ctxMenu.style.left = event.pageX + "px";
    ctxMenu.style.top = event.pageY + "px";
    if (+ctxMenu.style.top.replace('px', '') + ctxMenu.clientHeight + 10 > document.body.clientHeight) ctxMenu.style.top = document.body.clientHeight - ctxMenu.clientHeight - 10  + "px";
    if (+ctxMenu.style.left.replace('px', '') + ctxMenu.clientWidth + 10 > document.body.clientWidth) ctxMenu.style.left = event.pageX - ctxMenu.clientWidth + "px";
    ctxMenu["data-userID"] = element.id.includes('user') ? element.id.replace('user_', '') : element.id.includes('mention') ? element.id.split('_')[1] : 'false';
    if (ctxMenu["data-userID"] === 'false') ctxMenu["data-userID"] = element.id.includes('messageAvatar_') ? element.parentElement.children[0].getAttribute('data-user') : element.parentElement.parentElement.children[0].getAttribute('data-user');
    ctxMenu["data-opener"] = element.id;
}

function closeUserContextMenu() {
    const ctxMenu = document.getElementById("userCtx");
    document.querySelectorAll('[css-active="true"]').forEach((e) => e.setAttribute('css-active', 'false'));
    ctxMenu.style = "";
    ctxMenu["data-userID"] = "";
    ctxMenu["data-opener"] = "";
}

function copyUserID() {
    const ctxMenu = document.getElementById("userCtx");
    if(ctxMenu["data-userID"] === undefined || ctxMenu["data-userID"] === "") return;
    navigator.clipboard.writeText(ctxMenu["data-userID"]);
}

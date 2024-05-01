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
const messageSender = document.getElementById("messageSender");
const messageField = document.getElementById("messageField");
const mobileSend = document.getElementById("mobileSend");
const messageFieldPlaceholder = document.getElementById('messageFieldPlaceholder');
const messageContainer = document.getElementById("messagesContainer");
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
    memb = setInterval(getMembers, 20_000);
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
            message(eventData.data, true);
            break;
        case "ACK":
            hideToast();
            clearTimeout(heart);
            clearTimeout(memb);
            heart = setInterval(sendHeartbeat, 5000);
            memb = setInterval(getMembers, 20_000);
            currentUser = eventData.data.user;
            if(version === "") {version = eventData.data.version;}
            setUserProfile(eventData.data.user);
            ws.send(JSON.stringify({opCode: "GET_MEM"}));
            ws.send(JSON.stringify({opCode: "GET_SER"}));
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
            function userSort(a, b) {
                return a.user.username.toLowerCase() < b.user.username.toLowerCase() ? -1 : a.user.username.toLowerCase() > b.user.username.toLowerCase() ? 1 : 0;
            }
            userContainer.innerHTML = "";
            const onlineUsers = eventData.data.memberList.filter((x) => x.online === 'ONLINE').sort(userSort);
            const offlineUsers = eventData.data.memberList.filter((x) => x.online === 'OFFLINE').sort(userSort);
            const roles = {ONLINE: onlineUsers, OFFLINE: offlineUsers};
            for (const role of Object.keys(roles)) {
                userContainer.innerHTML += `<span>${role.toUpperCase()}・${roles[role].length}</span>`;
                roles[role].map((entry) => {
                    userStore[entry.user.ID] = entry.user;
                    const popup = document.getElementById('userPopup');
                    const cssActive = popup.getAttribute('data-user') === entry.user.ID && popup.getAttribute('openedBy') !== 'user' && !popup.getAttribute('openedBy').includes('_') ? 'true' : '';
                    userContainer.innerHTML += `
                    <div css-active="${cssActive}" class="user ${entry.online} exitable" id="${entry.user.ID}" onclick="openUserPopup('${entry.user.ID}', this)">
                    <img src="/resource/user/${entry.user.ID}?size=32"><div class="userStatus"></div><span>${entry.user.username}</span>
                    </div>`;
                });
            }
            ws.send(JSON.stringify({opCode: "GET_MSG"}));
            break;
        case "GET_MSG":
            messageContainer.innerHTML = '';
            eventData.data.messages.map((msg, index) => message(msg, false, eventData.data.messages[index === 0 ? 0 : index - 1]));
            messageContainer.setAttribute("loaded", "true");
            break;
        case "GET_SER":
            document.getElementById('serverNameSpan').innerText = eventData.data.server.name;
            break;
        case "DEL_MSG":
            if("messageID" in eventData.data){
                document.getElementById(eventData.data.messageID).remove();
            }
            break;
        case "UPD_PRF":
            document.getElementById("userPopupUsername").value = eventData.data.user.username ?? "";
            document.getElementById("userPopupDiscriminator").value = eventData.data.user.discriminator ?? "";
            setUserProfile(eventData.data.user);
            showToast('Profile Saved', false, 2.5);
    }
}

function setUserProfile(user) {
    userProfile.innerHTML = `<img class="exitable" src="/resource/user/${user.ID}?size=64">
    <div class="exitable" style="float: left;"><span id="userUsername">${user.username}</span><span id="userDiscriminator">#${user.discriminator??"0"}</span></div>`;
}

function parseTimestamp(timestamp, type){
    const msgTime = new Date(parseInt(timestamp));
    const now = new Date();
    const clock = `${msgTime.getHours().toString().padStart(2,"0")}:${msgTime.getMinutes().toString().padStart(2,"0")}`;
    const calendar = `${msgTime.getDate().toString().padStart(2,"0")}/${(msgTime.getMonth() + 1).toString().padStart(2,"0")}/${msgTime.getFullYear()}`;
    if (type === 'full') {
        if(now.getTime() - msgTime.getTime() < 1000*60*60*24 && now.getDate() === msgTime.getDate()){
            return `Today at ${clock}`;
        } else if(now.getTime() - msgTime.getTime() < 1000*60*60*24*2 && now.getDate() !== msgTime.getDate()){
            return `Yesterday at ${clock}`;
        } else {
            return `${calendar} ${clock}`;
        }
    } else if (type === 'clock') {
        return `${clock}`;
    } else if (type == 'calendar') {
        return `${calendar}`;
    } else {
        return parseTimestamp(timestamp, 'full');
    }

}

function message(data, scroll, previousMessage){
    if(data.error) return console.error(data.error);
    if (!previousMessage) previousMessage = {
        ID: "0",
        userID: messageContainer.children[messageContainer.children.length - 1].children[0].getAttribute('data-user'),
        createdAt: messageContainer.children[messageContainer.children.length - 1].children[0].getAttribute('data-time')
    }
    if (data.ID !== previousMessage.ID  && data.userID === previousMessage.userID && +previousMessage.createdAt + 300_000 > +data.createdAt) {
        messageContainer.innerHTML += `<div class="message" id="${data.ID}" oncontextmenu="openMessageContext(event, this)">
        <div style="display:none;" data-user="${data.userID}" data-time="${data.createdAt}"></div><span class="messageTimeSentAside">${parseTimestamp(data.createdAt, 'clock')}</span>
        <div class="messageContainer"></div></div>`;
        document.getElementById(`${data.ID}`).children[2].innerHTML += `<pre>${formatContent(data.content, data)}</pre>`;
    } else {
        const popup = document.getElementById('userPopup');
        const cssActive = popup.getAttribute('data-user') === data.userID && popup.getAttribute('openedBy') === `messageUsername_${data.ID}` || popup.getAttribute('openedBy') === `messageAvatar_${data.ID}` ? 'true' : '';
        messageContainer.innerHTML += `<div class="message" id="${data.ID}" oncontextmenu="openMessageContext(event, this)">
        <div style="display:none;" data-user="${data.userID}" data-time="${data.createdAt}"></div>
        <img css-active="${cssActive}" id="messageAvatar_${data.ID}" class="messageAvatar" src="/resource/user/${data.userID}?size=32" onclick="openUserPopup('${data.userID}', this)" />
        <div class="messageContainer"><span id="messageUsername_${data.ID}" class="messageUsername" onclick="openUserPopup('${data.userID}', this)">${userStore[data.userID]?.username ?? data.userID}</span>
        <span class="messageTimeSent">${parseTimestamp(data.createdAt)}</span></div></div>`;
        document.getElementById(`${data.ID}`).children[2].innerHTML += `<pre>${formatContent(data.content, data)}</pre>`;
    }
    if (scroll && scroll === true) moveChat(data.userID);
}

function formatContent(content, message) {
    content = DOMPurify.sanitize(linkifyHtml(content, {target: "_blank"}),{ ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['target','href'] });
    const mentionRgx = /&lt;@[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}&gt;/gmi;
    let m;
    do {
        m = mentionRgx.exec(content);
        if (m) {
            let id = m[0].substring(5,m[0].length-4);
            if (id === currentUser.ID) document.getElementById(`${message.ID}`).classList.add('mentions-you')
            content = content.replace(new RegExp(m[0],"g"),`<span id="mention_${id}" class="mention" onclick="openUserPopup('${id}', this)" data-user="${id}">@${userStore[id].username}</span>`);
        }
    } while (m);
    return content;
}

function openMessageContext(event, element) {
    const ctxMenu = document.getElementById("messageCtx");
    if(ctxMenu["data-messageID"] === element.id){
        ctxMenu.style = "";
        ctxMenu["data-messageID"] = "";
        return;
    }
    ctxMenu.style.display = "block";
    ctxMenu.style.left = (event.pageX - 10)+"px";
    ctxMenu.style.top = (event.pageY - 10)+"px";
    ctxMenu["data-messageID"] = element.id;
}

const toast = document.getElementById("snackbar");
function showToast(msg, load, time){
    toast.className = "show";
    toast.innerHTML = msg;
    if(time !== undefined && time !== null) setTimeout(() => toast.className = toast.className.replace("show", ""), time * 1000);
    if(load !== undefined && load !== null && load !== false) toast.innerHTML = `<p>${msg}</p><div id="dot-spin" class="dot-spin"></div>`;
}
function hideToast(){
    toast.className = "";
}

document.onclick = (event) => {
    const ctxMenu = document.getElementById("messageCtx");
    ctxMenu.style = "";
    ctxMenu["data-messageID"] = "";
    closePopup(event.target);
};

document.oncontextmenu = (event) => {
    event.preventDefault();
};

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
    if(message.length < 1) return;
    ws.send(JSON.stringify({
        opCode: "MSG",
        data: {
            content: message
        }
    }));
    messageField.innerText = "";
}

//prevent rich content in messageField
messageField.addEventListener("paste", e => {
    e.preventDefault();
    let text = (e.originalEvent || e).clipboardData.getData('text/plain');
    insertTextAtSelection(messageField, text);
});

function insertTextAtSelection(div, txt) {
    let sel = window.getSelection();
    let text = div.textContent;
    let before = Math.min(sel.focusOffset, sel.anchorOffset);
    let after = Math.max(sel.focusOffset, sel.anchorOffset);
    let afterStr = text.substring(after);
    div.textContent = text.substring(0, before) + txt + afterStr;
    sel.removeAllRanges();
    let range = document.createRange();
    range.setStart(div.childNodes[0], before + txt.length);
    range.setEnd(div.childNodes[0], before + txt.length);
    sel.addRange(range);
}

let keyMap = {}; //A map for what keys are currently pressed for messageField
messageField.onkeydown = messageField.onkeyup = function(e){
    if (messageContainer.scrollTop + messageContainer.clientHeight + 100 > messageContainer.scrollHeight) moveChat(currentUser.ID);
    keyMap[e.key] = e.type == 'keydown';
    messageField.scrollTop = messageField.scrollHeight;
    if(keyMap["Enter"] && !keyMap["Shift"] && !isMobile) {
        e.preventDefault();
        sendMessage(messageField.innerText.replace(/^\s+|\s+$/g, ""));
    }
    if (!isMobile) return;
    if (messageField.innerText === '\n' || messageField.innerText.length < 0) {
        messageFieldPlaceholder.style.display = "block";
    } else {
        messageFieldPlaceholder.style.display = "none";
    }
}

const leftContainer = document.getElementById("leftContainer");
const rightContainer = document.getElementById("rightContainer");
const leftToggle = document.getElementById("serverChannelListToggle");

if (isMobile) {
    document.body.style.minHeight = "100%";
    leftContainer.style = 'display: none; width: 100%; max-width: 100vw;';
    userContainer.style = 'display: none; width: 100%; min-width: 100%; max-width: 100vw;';
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

document.getElementById("logoutButton").onclick = () => location.href = "/logout";

userProfile.onclick = () => openUserPopup(currentUser.ID, userProfile, true);

window.onresize = () => {
    closePopup();
};

function closePopup(element) {
    const popup = document.getElementById(`userPopup`);
    if (popup.style.display === 'none') return;
    // element should only be excluded when window is resized
    if (!element) {
        popup.style.display = 'none';
        document.querySelectorAll('[css-active="true"]').forEach((e) => e.setAttribute('css-active', 'false'));
        return;
    }
    const ecl = element.classList;
    const parent = element.parentElement.classList;
    if (ecl.contains('mention') || ecl.toString().includes('message')) return;
    if (ecl.contains('exitable') || parent.contains('exitable') || element.id.includes('userPopup') || ecl.toString().includes('userPopup') || parent.toString().includes('userPopup')) return;
    document.querySelectorAll('[css-active="true"]').forEach((e) => e.setAttribute('css-active', 'false'));
    popup.setAttribute('data-user', '');
    popup.style.display = 'none';
}

function openUserPopup(userID, element, editable) {
    //clear user selection when popup is opened
    if (window.getSelection) {
        if (window.getSelection().empty) {  // Chrome
            window.getSelection().empty();
        } else if (window.getSelection().removeAllRanges) {  // Firefox
            window.getSelection().removeAllRanges();
        }
    } else if (document.selection) {  // IE
        document.selection.empty();
    }
    const user = userStore[userID];
    if (!user) return console.error('Invalid User.');
    const popup = document.getElementById(`userPopup`);
    document.querySelectorAll('[css-active="true"]').forEach((e) => e.setAttribute('css-active', 'false'));
    popup.setAttribute('data-user', '');
    if (popup.style.display === "flex" && popup.getAttribute('openedBy') === element.id) return popup.style.display = 'none';
    element.setAttribute('css-active', 'true');
    popup.setAttribute('openedBy', element.id);
    popup.setAttribute('data-user', userID);
    const popupEditable = document.getElementById(`userPopupEditable`);
    const popupNonEditable = document.getElementById(`userPopupNonEditable`);
    const userStatus = document.getElementById(userID).classList.toString().replace('user ', '').replace(' exitable', '')

    if (userID === currentUser.ID && editable) {
        popupEditable.style.display = 'flex';
        popupNonEditable.style.display = 'none';
        const avatar = document.getElementById(`userPopupAvatarEditable`);
        const banner = document.getElementById(`userPopupBannerEditable`);
        const status = document.getElementById(`userPopupStatusEditable`);
        const usernameInput = document.getElementById(`userPopupUsernameInput`);
        const discriminatorInput = document.getElementById(`userPopupDiscriminatorInput`);
        //const email = document.getElementById(`userPopupEmail`);
        const oldPassword = document.getElementById(`userPopupOldPassword`);
        const newPassword = document.getElementById(`userPopupNewPassword`);
        const saveButton = document.getElementById(`saveProfile`);
        status.classList.add(userStatus);
        status.classList.remove(userStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
        avatar.src = `/resource/user/${userID}?size=128`
        avatar.addEventListener("click", () => {
            showToast("Change PFP is a Work-In-Progress", false, 5);
        });
        banner.addEventListener("click", () => {
            showToast("Change Banner is a Work-In-Progress", false, 5);
        });
        saveButton.addEventListener("click", () => {
            const data = {};
            if(usernameInput.value.length > 0) data["username"] = usernameInput.value;
            if(discriminatorInput.value.length > 0) data["discriminator"] = discriminatorInput.value;
            if(newPassword.value.length > 0){
                if(oldPassword.value.length > 0){
                    //Complain to user.
                } else {
                    data["oldPass"] = oldPassword.value;
                    data["newPass"] = newPassword.value;
                }
            }
            ws.send(JSON.stringify({ opCode: "UPD_PRF", data }));
        });
    } else {
        popupEditable.style.display = 'none';
        popupNonEditable.style.display = 'flex';
        const avatar = document.getElementById(`userPopupAvatar`);
        //const banner = document.getElementById(`userPopupBanner`);
        const username = document.getElementById(`userPopupUsername`);
        const discriminator = document.getElementById(`userPopupDiscriminator`);
        const joined = document.getElementById(`userPopupJoined`);
        const status = document.getElementById(`userPopupStatus`);
        avatar.src = `/resource/user/${userID}?size=128`;
        status.classList.add(userStatus);
        status.classList.remove(userStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
        username.innerHTML = user.username ?? "Nya";
        discriminator.innerHTML = user.discriminator ?? "0000";
        joined.innerHTML = parseTimestamp(user.createdAt);
    }

    popup.style = 'display: flex;';
    const elementData = element.getBoundingClientRect();
    let popupData = popup.getBoundingClientRect();
    if (isMobile) return popup.style.inset = `${document.body.clientHeight / 2}px 10px 10px`;
    if (element.id === 'user') {
        //position popup above element if element is the current user profile
        popup.style.bottom = document.body.clientHeight - elementData.top + 10 + 'px';
        popupData = popup.getBoundingClientRect();
        if (popupData.top < 0) popup.style.top = '10px';
        popup.style.left = '10px';
    } else {
        //position popup to the right of element
        popup.style.top = elementData.top + 'px';
        popupData = popup.getBoundingClientRect();
        if (popupData.bottom > document.body.clientHeight) popup.style.top = (elementData.top - (popupData.bottom - document.body.clientHeight)) - 10 + 'px';
        popup.style.left = elementData.right + 10 + 'px';
        //position popup to the left if popup was going to be off screen
        popupData = popup.getBoundingClientRect();
        if (popupData.right > document.body.clientWidth) popup.style.left = (elementData.left - popupData.width) - 10 + 'px';
    }
}

function moveChat(user) {
    if (!user) return messageContainer.scrollTop = messageContainer.scrollHeight;
    if (user === currentUser.ID) messageContainer.scrollTop = messageContainer.scrollHeight;
    else if (messageContainer.scrollTop + messageContainer.clientHeight + 100 > messageContainer.scrollHeight) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
}

const wsURL = `ws${location.host.startsWith("localhost")?"":"s"}://${location.host}`;
let ws = new WebSocket(wsURL);
ws.onopen = onOpen;
ws.onmessage = onMessage;
ws.onclose = onClose;
ws.onerror = onError;
let heart, memb, currentUser, currentChannel, currentServer;
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

messageObserver.observe(messageContainer, {subtree: true, attributeFilter: ["loaded"], attributeOldValue: true});

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
    if(eventData.data.error) return console.error(data.error);
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
            //needed to get currentUser, currentServer and currentChannel from other files
            document.headpat = {};
            currentUser = eventData.data.user;
            document.headpat["currentUser"] = eventData.data.user;
            currentServer = eventData.data.state.currentServer;
            document.headpat["currentServer"] = eventData.data.state.currentServer;
            currentChannel = eventData.data.state.currentChannel;
            document.headpat["currentChannel"] = eventData.data.state.currentChannel;
            if(version === "") {version = eventData.data.version;}
            setUserProfile(eventData.data.user);
            ws.send(JSON.stringify({opCode: "GET_MEM"}));
            ws.send(JSON.stringify({opCode: "GET_SER"}));
            //Intentional fallthrough.
        case "HRT":
            if(eventData.data.version !== version){
                showToast("Version out of date, reloading in 5 seconds...");
                return setTimeout(() => location.reload(), 5000);
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
                userContainer.innerHTML += `<span>${role.toUpperCase()} — ${roles[role].length}</span>`;
                roles[role].map((entry) => {
                    userStore[entry.user.ID] = entry.user;
                    const popup = document.getElementById('userPopup');
                    let cssActive = popup.getAttribute('data-user') === entry.user.ID && popup.getAttribute('openedBy') !== 'user' && !popup.getAttribute('openedBy').includes('_') ? 'true' : '';
                    cssActive = document.getElementById('userCtx')['data-opener'] = `user_${entry.user.ID}`;
                    userContainer.innerHTML += `
                    <div css-active="${cssActive}" class="user ${entry.online} exitable" id="user_${entry.user.ID}" onclick="openUserPopup('${entry.user.ID}', this)" oncontextmenu="openUserContext(event, this)">
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
            document.getElementById("rightNavChannelName").innerText = eventData.data.server.channels[currentChannel].name;
            document.getElementById("messageFieldPlaceholder").innerText = `Message #${eventData.data.server.channels[currentChannel].name}`;
            document.getElementById("channelsContainer").innerHTML = eventData.data.server.channels.map(channel => {
                return `<a class="channel${currentChannel === channel.ID ? " active" : ""}" id="${channel.ID}">
                        <svg x="0" y="0" class="icon_ae0b42" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>
                        <span class="channelName">${channel.name}</span>
                    </a>`;
            }).join("\n");
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
        userID: messageContainer.children[messageContainer.children.length - 1]?.children[0]?.getAttribute('data-user') ?? "0",
        createdAt: messageContainer.children[messageContainer.children.length - 1]?.children[0]?.getAttribute('data-time') ?? "0"
    }
    if (data.ID !== previousMessage.ID  && data.userID === previousMessage.userID && +previousMessage.createdAt + 300_000 > +data.createdAt) {
        const cssActive = document.getElementById('messageCtx')["data-messageID"] === `${data.ID}`;
        messageContainer.innerHTML += `<div class="message" id="${data.ID}" oncontextmenu="openMessageContext(event, this)" css-active="${cssActive}">
        <div style="display:none;" data-user="${data.userID}" data-time="${data.createdAt}"></div><span class="messageTimeSentAside">${parseTimestamp(data.createdAt, 'clock')}</span>
        <div class="messageContainer"></div></div>`;
        document.getElementById(`${data.ID}`).children[2].innerHTML += `<pre>${formatContent(data.content, data)}</pre>`;
    } else {
        const popup = document.getElementById('userPopup');
        const userCtx = document.getElementById('userCtx');
        let cssActive = popup.getAttribute('data-user') === data.userID && popup.getAttribute('openedBy') === `messageUsername_${data.ID}` || popup.getAttribute('openedBy') === `messageAvatar_${data.ID}` ? 'true' : '';
        cssActive = document.getElementById('messageCtx')["data-messageID"] === `${data.ID}` || userCtx["data-opener"] === `messageAvatar_${data.ID}` || userCtx["data-opener"] === `messageUsername_${data.ID}` ? 'true' : cssActive;
        messageContainer.innerHTML += `<div class="message" id="${data.ID}" oncontextmenu="openMessageContext(event, this)" css-active="${cssActive}">
        <div style="display:none;" data-user="${data.userID}" data-time="${data.createdAt}"></div>
        <img oncontextmenu="openUserContext(event, this)" id="messageAvatar_${data.ID}" class="messageAvatar" src="/resource/user/${data.userID}?size=32" onclick="openUserPopup('${data.userID}', this)" />
        <div class="messageContainer"><span oncontextmenu="openUserContext(event, this)" id="messageUsername_${data.ID}" class="messageUsername" onclick="openUserPopup('${data.userID}', this)">${userStore[data.userID]?.username ?? data.userID}</span>
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
            content = content.replace(new RegExp(m[0],"g"),`<span id="mention_${id}_${message.ID}" class="mention" oncontextmenu="openUserContext(event, this)" onclick="openUserPopup('${id}', this)" data-user="${id}">@${userStore[id].username}</span>`);
        }
    } while (m);
    return content;
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
    message = message
        .split(" ")
        .map(word => {
            if(word.startsWith("@") && word !== "@SYSTEM"){
                let id;
                if(word.split("#").length > 1){
                    //Discriminator provided
                    id = Object.keys(userStore).find(key => userStore[key].username === word.split("#")[0].substring(1) && userStore[key].discriminator === word.split("#")[1]);
                } else {
                    //Best effort
                    id = Object.keys(userStore).find(key => userStore[key].username === word.substring(1));
                }
                return id !== undefined ? `<@${id}>` : word;
            } else {
                return word;
            }
        })
        .join(" ");
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

if (isMobile) {
    const leftContainer = document.getElementById("leftContainer");
    const rightContainer = document.getElementById("rightContainer");
    const leftToggle = document.getElementById("serverChannelListToggle");
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
        if (isMobile) document.getElementById("messages").style.display = "flex";
        userContainer.style.display = "none";
    } else {
        if (isMobile) document.getElementById("messages").style.display = "none";
        userContainer.style.display = "block";
    }
});

document.onclick = (event) => {
    closeMessageContextMenu();
    closeUserContextMenu();
    closePopup(event.target);
};

document.oncontextmenu = (event) => {
    event.preventDefault();
};

window.onresize = () => {
    closeMessageContextMenu();
    closeUserContextMenu();
    closePopup();
};

function moveChat(user) {
    if (!user) return messageContainer.scrollTop = messageContainer.scrollHeight;
    if (user === currentUser.ID) messageContainer.scrollTop = messageContainer.scrollHeight;
    else if (messageContainer.scrollTop + messageContainer.clientHeight + 100 > messageContainer.scrollHeight) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
}

if (/firefox/i.test(navigator.userAgent)) {
    messageField.style.scrollbarColor = 'var(--bg-0) var(--bg-5)';
    messageField.style.scrollbarGutter = 'stable';
    messageField.style.scrollbarWidth = 'thin';
    document.getElementById('serverList').style.scrollbarWidth = 'none';
    const channelsContainer = document.getElementById('channelsContainer');
    channelsContainer.style.scrollbarColor = 'var(--bg-0) var(--bg-3)';
    channelsContainer.style.scrollbarGutter = 'stable';
    channelsContainer.style.scrollbarWidth = 'thin';
    for (const element of document.getElementsByClassName('userPopupBottom')) {
        element.style.scrollbarColor = 'var(--bg-1) var(--bg-0)';
        element.style.scrollbarGutter = 'stable';
        element.style.scrollbarWidth = 'thin';
    }
    messageContainer.style.scrollbarColor = 'var(--bg-1) var(--bg-4)';
    messageContainer.style.scrollbarGutter = 'stable';
    messageContainer.style.scrollbarWidth = 'thin';
    userContainer.style.scrollbarColor = 'var(--bg-1) var(--bg-3)';
    userContainer.style.scrollbarGutter = 'stable';
    userContainer.style.scrollbarWidth = 'thin';
    setTimeout(() => showToast('You may experience a degraded experience on Firefox', false, 5), 2000);
}
const wsURL = `ws${location.host.startsWith("localhost")||location.host.startsWith("192.168")?"":"s"}://${location.host}`;
let ws = new WebSocket(wsURL);
ws.onopen = onOpen;
ws.onmessage = onMessage;
ws.onclose = onClose;
ws.onerror = onError;
let heart, memb, currentUser, currentChannel, currentServer;
let version = "";
let initialStage = 0;

document.headpat = {};
document.headpat["messageStore"] = {};

let userStore = {};
let iceCreds;

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
    if(eventData.error) {
        showToast(JSON.stringify(eventData.error), false, 5);
        return console.error(eventData.error);
    }
    switch(eventData.opCode){
        case "RTC":
            handleRTC(eventData.data);
            break;
        case "MSG":
            message(eventData.data, true);
            break;
        case "ACK":
            initialStage = 0;
            hideToast();
            clearTimeout(heart);
            clearTimeout(memb);
            heart = setInterval(sendHeartbeat, 5000);
            //needed to get currentUser, currentServer and currentChannel from other files
            currentUser = eventData.data.user;
            document.headpat["currentUser"] = eventData.data.user;
            currentServer = eventData.data.state.currentServer;
            document.headpat["currentServer"] = eventData.data.state.currentServer;
            currentChannel = eventData.data.state.currentChannel;
            document.headpat["currentChannel"] = eventData.data.state.currentChannel;
            if(version === "") {version = eventData.data.version;}
            iceCreds = eventData.data.iceCreds;
            setUserProfile(eventData.data.user);
            ws.send(JSON.stringify({opCode: "GET_SER"}));
            //Intentional fallthrough.
        case "HRT":
            if(eventData.data.version !== version){
                showToast("Version out of date, reloading in 5 seconds...");
                return setTimeout(() => location.reload(), 5000);
            }
            break;
        case "UPD_MEM":
            const user = eventData.data.user;
            userStore[user.ID] = user;
            let nonceu = Date.now();
            document.querySelectorAll(`[data-userID="${user.ID}"]`).forEach(element => {
                if (element.classList.contains('avatar')) element.src = `/resource/user/${user.ID}/avatar?size=64&nonce=${nonceu}`;
                if (element.classList.contains('messageUsername')) element.innerText = user.username;
                if (element.classList.contains('mention')) element.innerText = `@${user.username}`;
                if (element.classList.contains('user')) ws.send(JSON.stringify({opCode: "GET_MEM"}));
            })
            break;
        case "GET_MEM":
            function userSort(a, b) {
                return a.user.username.toLowerCase() < b.user.username.toLowerCase() ? -1 : a.user.username.toLowerCase() > b.user.username.toLowerCase() ? 1 : 0;
            }
            const onlineUsers = eventData.data.memberList.filter((x) => x.online === 'ONLINE').sort(userSort);
            const offlineUsers = eventData.data.memberList.filter((x) => x.online === 'OFFLINE').sort(userSort);
            const roles = {ONLINE: onlineUsers, OFFLINE: offlineUsers};
            userContainer.innerHTML = "";
            let nonce = Date.now();
            for (const role of Object.keys(roles)) {
                userContainer.innerHTML += `<span>${role.toUpperCase()} — ${roles[role].length}</span>`;
                roles[role].map((entry) => {
                    userStore[entry.user.ID] = entry.user;
                    const popup = document.getElementById('userPopup');
                    let cssActive = popup.getAttribute('data-user') === entry.user.ID && popup.getAttribute('openedBy') !== 'user' && !popup.getAttribute('openedBy').includes('_') ? 'true' : '';
                    cssActive = document.getElementById('userCtx')['data-opener'] = `user_${entry.user.ID}`;
                    userContainer.innerHTML += `
                    <div data-userID="${entry.user.ID}" css-active="${cssActive}" class="user ${entry.online} exitable" id="user_${entry.user.ID}" onclick="openUserPopup('${entry.user.ID}', this)" oncontextmenu="openUserContext(event, this)">
                    <img onError="this.src='/resource/user/${entry.user.ID}/avatar?size=64&nonce=0'" data-userID="${entry.user.ID}" class="avatar" loading="lazy" src="/resource/user/${entry.user.ID}/avatar?size=64&nonce=${nonce}"><div class="userStatus"></div><span>${entry.user.username}</span>
                    </div>`;
                });
            }
            if(initialStage === 0){
                initialStage++;
                ws.send(JSON.stringify({opCode: "GET_MSG"}));
            }
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
                switch(channel.type){
                    case "AUDIO":
                        return `<a class="channel${currentChannel === channel.ID ? " active" : ""}" id="${channel.ID}" onclick="vcClick('${channel.ID}')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 75 75" height="20" width="20" version="1.0">
<path d="M39.389,13.769 L22.235,28.606 L6,28.606 L6,47.699 L21.989,47.699 L39.389,62.75 L39.389,13.769z" style="stroke: rgb(128, 132, 142);stroke-width:5;stroke-linejoin:round;fill: rgb(128, 132, 142);"/>
<path d="M48,27.6a19.5,19.5 0 0 1 0,21.4M55.1,20.5a30,30 0 0 1 0,35.6M61.6,14a38.8,38.8 0 0 1 0,48.6" style="fill:none;stroke: rgb(128, 132, 142);stroke-width:5;stroke-linecap:round"/>
</svg>
                        <span class="channelName">${channel.name}</span>
                    </a>`;
                    default:
                        return `<a class="channel${currentChannel === channel.ID ? " active" : ""}" id="${channel.ID}">
                        <svg x="0" y="0" class="icon_ae0b42" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd" class=""></path></svg>
                        <span class="channelName">${channel.name}</span>
                        </a>`;
                }

            }).join("\n");
            if(initialStage === 0){
                ws.send(JSON.stringify({opCode: "GET_MEM"}));
            }
            break;
        case "DEL_MSG":
            if("messageID" in eventData.data){
                document.getElementById(eventData.data.messageID).remove();
            }
            break;
        case "UPD_PRF":
            document.getElementById("userPopupUsername").value = eventData.data.user.username ?? "";
            document.getElementById("userPopupDiscriminator").value = eventData.data.user.discriminator ?? "";
            document.getElementById("userPopupRole").value = eventData.data.user.role ?? "";
            setUserProfile(eventData.data.user);
            showToast('Profile Saved', false, 2.5);
            break;
        case "IMG":
            hideToast();
            console.log(eventData);
    }
}

function setUserProfile(user) {
    userProfile.innerHTML = `<img onError="this.src='/resource/user/${user.ID}/avatar?size=64&nonce=0'" data-userID="${user.ID}" loading="lazy" class="exitable avatar" src="/resource/user/${user.ID}/avatar?size=64">
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
    document.headpat["messageStore"][data.ID] = data;
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
        <img onError="this.src='/resource/user/${data.userID}/avatar?size=64&nonce=0'" loading="lazy" data-userID="${data.userID}" oncontextmenu="openUserContext(event, this)" id="messageAvatar_${data.ID}" class="messageAvatar avatar" src="/resource/user/${data.userID}/avatar?size=64" onclick="openUserPopup('${data.userID}', this)" />
        <div class="messageContainer"><span data-userID="${data.userID}" oncontextmenu="openUserContext(event, this)" id="messageUsername_${data.ID}" class="messageUsername" onclick="openUserPopup('${data.userID}', this)">${userStore[data.userID]?.username ?? data.userID}</span>
        <span class="messageTimeSent">${parseTimestamp(data.createdAt)}</span></div></div>`;
        document.getElementById(`${data.ID}`).children[2].innerHTML += `<pre>${formatContent(data.content, data)}</pre>`;
    }
    if (scroll && scroll === true) moveChat(data.userID);
}

function formatContent(content, message) {
    content = linky(message.ID, DOMPurify.sanitize(content));
    const mentionRgx = /&lt;@[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}&gt;/gmi;
    let m;
    do {
        m = mentionRgx.exec(content);
        if (m) {
            let id = m[0].substring(5,m[0].length-4);
            if (id === currentUser.ID) document.getElementById(`${message.ID}`).classList.add('mentions-you')
            content = content.replace(new RegExp(m[0],"g"),`<span id="mention_${id}_${message.ID}" data-userID="${id}" class="mention" oncontextmenu="openUserContext(event, this)" onclick="openUserPopup('${id}', this)" data-user="${id}">@${userStore[id].username}</span>`);
        }
    } while (m);
    const emojiRegex = /:\w+:/g;
    const messageEmojis = [...content.matchAll(emojiRegex)];
    const emojilessContent = content.replaceAll(emojiRegex, '').replace(/^\s+|\s+$/g, "");
    for (const emojiText of messageEmojis) {
        const emojiData = document.headpat.emojis.emojiDefinitions.find((element) => element.names.find(name => name === `${emojiText}` ));
        twemoji.className = emojilessContent.length === 0 && messageEmojis.length < 31 ? 'largeEmoji' : 'emoji';
        content = content.replace(emojiText, twemoji.parse(emojiData.emoji));
    }
    return content;
}

function linky(messageID, content) {
    const links = linkify.find(content);
    const anchors = [...content.matchAll(/<a (.*?)<\/a>/g)];
    for (const index in links) {
        const link = links[index];
        const anchor = anchors[index]?.at(0);
        if (anchor && anchor.includes(link.href)) {
            content = content.replace(anchor, `${anchor.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}`);
            continue;
        }
        content = content.replace(link.href, `<a href="${link.href}" target="_blank">${link.href}</a>`);
        content += `<img loading="lazy" height="350px" src="${link.href}" onerror="this.remove()" onload="handleImage(this, '${messageID}')" />`;
    }
    return content;
}

function handleImage(element, messageID) {
    const message = document.headpat['messageStore'][messageID];
    element.setAttribute('height', '');
    if (message.content === element.src) {
        element.parentElement.innerHTML = element.outerHTML.replace('onload="handleImage', 'data-old="');
    }
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
    leave();
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

function getChatCursorPosition(element) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
    }
    return 0;
}

const targetAC = document.getElementById("targetAutoComplete");
let targetAutoCompleteVisible = false;
let targetUserSearch = "";
const keyMap = {};

function hideAC() {
    targetAC.style.display = "none";
    targetAC.innerHTML = "";
    targetAutoCompleteVisible = false;
}

function handleCaretMove() {
    const cursorPos = window.getSelection().getRangeAt(0).startOffset;
    const textBeforeCursor = messageField.innerText.slice(0, cursorPos);

    // Only match if `@` is at the beginning or preceded by a space
    const match = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);

    if (match) {
        targetUserSearch = match[1].toLowerCase();
        const filteredUsers = Object.keys(userStore).filter(userID =>
            userStore[userID].username.toLowerCase().startsWith(targetUserSearch)
        );

        targetAC.innerHTML = `<div><p>MEMBERS</p></div>
            ${filteredUsers.map(userID => `
                <div data-userid="${userID}" css-active="user_${userID}" class="user" id="user_${userID}">
                    <img style="width: 32px; height: 32px; border-radius: 50%;" 
                         src="/resource/user/${userID}/avatar?size=64&nonce=${Date.now()}" 
                         onerror="this.src='/resource/user/${userID}/avatar?size=64&nonce=0'" 
                         class="avatar" loading="lazy">
                    <span>${userStore[userID].username}</span>
                </div>`).join('')}`;

        targetAC.style.display = "flex";
        targetAutoCompleteVisible = true;
    } else {
        hideAC();
    }
}

messageField.addEventListener("mouseup", handleCaretMove);
document.addEventListener("selectionchange", handleCaretMove);


messageField.onkeydown = messageField.onkeyup = function(e) {
    if (messageContainer.scrollTop + messageContainer.clientHeight + 100 > messageContainer.scrollHeight) {
        moveChat(currentUser.ID);
    }

    keyMap[e.key] = e.type === 'keydown';
    messageField.scrollTop = messageField.scrollHeight;

    handleCaretMove()

    if (keyMap["Enter"] && !keyMap["Shift"] && !isMobile) {
        e.preventDefault();
        if (targetAutoCompleteVisible) {
            hideAC();
        }
        sendMessage(messageField.innerText.trim());
    }

    if (!isMobile) return;
    messageFieldPlaceholder.style.display = messageField.innerText.trim() === "" ? "block" : "none";
};

targetAC.addEventListener("click", (e) => {
    const selectedUserDiv = e.target.closest("[data-userid]");
    if (selectedUserDiv) {
        const userID = selectedUserDiv.getAttribute("data-userid");
        const username = userStore[userID].username;

        const cursorPos = window.getSelection().getRangeAt(0).startOffset;
        const textBeforeCursor = messageField.innerText.slice(0, cursorPos);
        //TODO: SeaBass do cool mention magic perhaps here?
        const newText = textBeforeCursor.replace(/@(\w*)$/, `<@${userID}>`);

        messageField.innerText = `${newText} ${messageField.innerText.slice(cursorPos)}`;
        hideAC();

        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(messageField.childNodes[0], newText.length);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        messageField.focus();
    }
});


if (isMobile) {
    const leftContainer = document.getElementById("leftContainer");
    const rightContainer = document.getElementById("rightContainer");
    const leftToggle = document.getElementById("serverChannelListToggle");
    document.body.style.minHeight = "100%";
    leftContainer.style = 'display: none; width: 100%; max-width: 100vw;';
    userContainer.style = 'display: none; width: 100%; min-width: 100%; max-width: 100vw;';
    document.getElementById('messages').style.maxWidth = '100vw';
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
        document.getElementById("messages").style.maxWidth = "100%";
        if (isMobile) document.getElementById("messages").style.display = "flex";
        userContainer.style.display = "none";
    } else {
        document.getElementById("messages").style = "";
        if (isMobile) document.getElementById("messages").style.display = "none";
        userContainer.style.display = "block";
    }
});

document.onclick = (event) => {
    closeMessageContextMenu();
    closeUserContextMenu();
    closePopup(event.target);
    togglePicker(event.target);
};

document.oncontextmenu = (event) => {
    event.preventDefault();
};

window.onresize = () => {
    closeMessageContextMenu();
    closeUserContextMenu();
    closePopup();
};

//to fix a chrome memory bug
window.addEventListener('beforeunload', function () {
    document = {};
});

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
    setTimeout(() => showToast('You may have a degraded experience on Firefox', false, 5), 2000);
}

let hover, interval;
let uploadoverlay = document.getElementById("file-upload");
document.getElementById("channelContentContainer").ondragover = (e) => {
    e.preventDefault();
    clearInterval(interval);
    interval = setInterval(()=>{
        hover = false;
        clearInterval(interval);

        uploadoverlay.style = "";
        console.log("LEAVE");
    }, 100);

    if(!hover){
        hover = !hover;
        console.log("ENTER");
        uploadoverlay.style = "background-color: rgba(0,0,0,0.2); height: 100%; width: 1000000%; display: block;";
    }
}

document.getElementById("channelContentContainer").ondrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
        [...e.dataTransfer.items].forEach((item, i) => {
            if (item.kind === "file") {
                const file = item.getAsFile();
                if(checkIfImage(file)) uploadImage(file);
            }
        });
    } else {
        [...e.dataTransfer.files].forEach((file, i) => {
            if(checkIfImage(file)) uploadImage(file);
        });
    }
}

function checkIfImage(file){
    return ["image/png", "image/gif", "image/bmp", "image/jpeg"].includes(file.type);
}

function uploadImage(image){
    console.log(image);
    const reader = new FileReader();
    reader.readAsArrayBuffer(image);
    reader.onload = () => {
        const uint8Array = new Uint8Array(reader.result);
        const base64String = btoa(
            uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        ws.send(JSON.stringify({
            opCode: "IMG",
            data: {
                buffer: base64String
            }
        }));
        showToast("Image uploading, will be sent once uploaded.",true);
    };
}

let rtcLoad = false;
let channelId, connectId;

async function vcClick(id){
    if(!channelId) join(id);
}

const voiceChannelInfo = document.getElementById("voiceChannelInfo");
const voiceChannelState = document.getElementById("voiceChannelState");
const voiceChannelName = document.getElementById("voiceChannelName");
const connections = {};

async function join(id){
    if(!rtcLoad) await loadRTC();
    const voice = document.getElementById(id);
    document.getElementById(id).style.color = "#0f0";
    connectId = id;
    voiceChannelInfo.style.display = "flex";
    voiceChannelState.innerText = "RTC connecting: ";
    voiceChannelState.style.color = "#cc0";
    voiceChannelName.innerText = voice.querySelectorAll(`span`)[0].innerText;
    send({
        opCode: "RTC",
        data: {
            type: "JOIN",
            channelID: id,
            muted
        }
    });
}

function createVoiceList(users){
    let voiceChat = document.getElementById(channelId);
    const vcUserCont = document.createElement("div");
    vcUserCont.id = "voiceChannelUserContainer";
    users = users.map(x => userStore[x]).sort((a,b)=>{a.username.localeCompare(b.username)});
    users.forEach(user => {
        vcUserCont.innerHTML += `
<div data-userid="${user.ID}" css-active="user_${user.ID}" class="user ONLINE exitable" id="vcuser_${user.ID}" onclick="openUserPopup('${user.ID}',this)" oncontextmenu="openUserContext(event, this)">
    <img id="vcuser_${user.ID}_avatar" onerror="this.src='/resource/user/${user.ID}/avatar?size=32&nonce=0'" data-userid="${user.ID}" class="avatar" loading="lazy" src="/resource/user/${user.ID}/avatar?size=32&nonce=${Date.now()}">
    <span>${user.username}</span>
</div>`;
    });
    if(voiceChat && voiceChat.parentNode){
        voiceChat.parentNode.insertBefore(vcUserCont,voiceChat.nextSibling);
    }
}

function updateVoiceList(user, operation, value){
    let voiceChat = document.getElementById("voiceChannelUserContainer");
    if(!voiceChat) return;
    const target = document.getElementById(`vcuser_${user.ID}`);
    switch(operation){
        case "MUTE":
            let checkMute = document.getElementById(`${user.ID}_muted`);
            if(value){
                if(checkMute) return;
                target.innerHTML += `<div id="${user.ID}_muted" class="voiceButton muted" style="">
                    <svg id="${user.ID}_muteicon" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24px" height="24px" viewBox="0 0 24 24" style="display: flex;"><path fill-rule="evenodd" d="M14.0319673,15.4461809 C13.4364541,15.7980706 12.7418086,16 12,16 C9.790861,16 8,14.209139 8,12 L8,9.41421356 L1.29289322,2.70710678 L2.70710678,1.29289322 L22.7071068,21.2928932 L21.2928932,22.7071068 L16.9056439,18.3198574 C15.7991209,19.1800111 14.4607085,19.7559585 13,19.9381062 L13,21 L16,21 L16,23 L8,23 L8,21 L11,21 L11,19.9381062 C7.05368842,19.4460082 4,16.0796177 4,12 L4,10 L6,10 L6,12 C6,15.3137085 8.6862915,18 12,18 C13.2958304,18 14.4957155,17.589209 15.4765344,16.8907479 L14.0319673,15.4461809 Z M10,11.4142136 L10,12 C10,13.1045695 10.8954305,14 12,14 C12.1791593,14 12.3528166,13.9764427 12.5180432,13.9322568 L10,11.4142136 Z M16,11.7857865 L14,9.78578649 L14,5 C14,3.8954305 13.1045695,3 12,3 C10.8954305,3 10,3.8954305 10,5 L10,5.78578649 L8.14460779,3.93039427 C8.61238846,2.24059489 10.161316,1 12,1 C14.209139,1 16,2.790861 16,5 L16,11.7857865 Z M17.7907353,13.5765218 C17.9271822,13.0741479 18,12.5455777 18,12 L18,10 L20,10 L20,12 C20,13.116226 19.7713927,14.1790579 19.3584437,15.1442302 L17.7907353,13.5765218 Z"></path></svg>
                </div>`;
            } else {
                if(checkMute) return checkMute.remove();
            }
            break;
        case "ADD":
            voiceChat.innerHTML += `
<div data-userid="${user.ID}" css-active="user_${user.ID}" class="user ONLINE exitable" id="vcuser_${user.ID}" onclick="openUserPopup('${user.ID}',this)" oncontextmenu="openUserContext(event, this)">
    <img id="vcuser_${user.ID}_avatar" onerror="this.src='/resource/user/${user.ID}/avatar?size=32&nonce=0'" data-userid="${user.ID}" class="avatar" loading="lazy" src="/resource/user/${user.ID}/avatar?size=32&nonce=${Date.now()}">
    <span>${user.username}</span>
</div>`;
            break;
        case "DEL":
            target.remove();
            break;
        case "SPEAK":
            let image = document.getElementById(`vcuser_${user.ID}_avatar`);
            if(value){
                image.className += " speaking";
            } else {
                image.className = image.className.split(" speaking")[0];
            }
            break;
    }
}

const { RTCPeerConnection, RTCSessionDescription } = window;
let iceCache = {};
let debugRTC = false;
async function handleRTC(data){
    if(debugRTC) console.log(data);
    if(data.muted) muted = data.muted;
    switch(data.type){
        case "ALONE":
            channelId = connectId;
            //showToast(`Joined channel ${channelId}`,false,2);
            voiceChannelState.innerText = "RTC waiting: ";
            createVoiceList([currentUser.ID]);
            break;
        case "SEND_OFFER":
            channelId = connectId;
            //showToast(`Joined channel ${channelId}`,false,2);
            const que = [];
            data.members.forEach(member => {
                que.push(createNewPeer(member));
            });
            Promise.all(que).then(()=>createOffer(currentUser.ID));
            createVoiceList([currentUser.ID, ...data.members]);
            break;
        case "OFFER":
            await createNewPeer(data.target);
            const answer = await createAnswer(data.target,data.offer);
            send({
                opCode: "RTC",
                data: {
                    type: "ANSWER",
                    answer,
                    target: data.target
                }
            });
            break;
        case "ANSWER":
            await receiveAnswer(data.target, data.answer);
            break;
        case "CANDIDATE":
            await receiveCandidate(data);
            break;
        case "JOIN":
            //showToast(`${data.user.username} joined channel ${channelId}`,false,2);
            updateVoiceList(data.user,"ADD");
            updateVoiceList(data.user, "MUTE", data.muted);
            break;
        case "LEAVE":
            if(!connections[data.user.ID]) return;
            //showToast(`${data.user.username} left channel ${channelId}`,false,2);
            updateVoiceList(data.user, "DEL");
            const peerConnection = connections[data.user.ID];
            peerConnection.close();
            delete connections[data.user.ID];
            break;
        case "MUTE":
            updateVoiceList(userStore[data.target],"MUTE",data.value);
            break;
        case "SPEAK":
            updateVoiceList(userStore[data.target],"SPEAK",data.value);
            break;
        case "ERR":
            console.error(data);
            if(channelId){
                await leave();
            }
            await unloadRTC();
            break;
    }
}

let localStream,checkIfSpeaking;

async function loadRTC() {
    const localAudio = document.getElementById("localAudio");
    let sentStop = true;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localAudio.srcObject = localStream;

    rtcLoad = true;
    voiceChannelInfo.style.display = "flex";

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
        await audioCtx.resume();
    }

    const aCtxAnalyze = audioCtx.createAnalyser();
    aCtxAnalyze.fftSize = 256;

    const mic = audioCtx.createMediaStreamSource(localStream);
    mic.connect(aCtxAnalyze);

    const dataArr = new Uint8Array(aCtxAnalyze.frequencyBinCount);

    checkIfSpeaking = setInterval(async () => {
        aCtxAnalyze.getByteFrequencyData(dataArr);
        let vol = dataArr.reduce((a, b) => a + b) / dataArr.length;
        if (vol > 10) {
            if(!sentStop) return;
            sentStop = false;
            send({
                opCode: "RTC",
                data: {
                    type: "SPEAK",
                    value: true
                }
            });
        } else {
            if (sentStop) return;
            sentStop = true;
            send({
                opCode: "RTC",
                data: {
                    type: "SPEAK",
                    value: false
                }
            });
        }
    },20);
}

function adjustVolumeOfPeer(id, volume){
    let remoteAudio = document.getElementById(`remoteAudio-${id}`);
    remoteAudio.volume = volume;
}

async function unloadRTC(){
    const localAudio = document.getElementById("localAudio");
    if(localStream){
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    localAudio.srcObject = null;
    rtcLoad = false;
    voiceChannelInfo.style.display = "none";
    clearInterval(checkIfSpeaking);
    if(channelId || connectId){
        document.getElementById(channelId ?? connectId).style.color = "rgb(128, 132, 142)";
        channelId = undefined;
        connectId = undefined;
    }
}

async function leave(){
    //showToast(`Left channel ${channelId}`,false,2);
    if(channelId) {
        send({
            opCode: "RTC",
            data: {
                type: "LEAVE"
            }
        });
    }
    if(channelId || connectId){
        document.getElementById(channelId ?? connectId).style.color = "rgb(128, 132, 142)";
        channelId = undefined;
        connectId = undefined;
    }
    document.getElementById("voiceChannelInfo").style.display = "none";
    let voiceChat = document.getElementById("voiceChannelUserContainer");
    if(voiceChat) voiceChat.remove();
    unloadRTC();
    Object.keys(connections).every(key =>{
        connections[key].close();
        delete connections[key];
    });
}

async function createNewPeer(id){
    if(connections[id]) return;
    const peerConnection = new RTCPeerConnection({
        iceServers:[
            {
                urls: iceCreds.urls,
                credential: iceCreds.password,
                username: iceCreds.username
            }
        ],
        iceTransportPolicy: "relay"
    });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = ({candidate}) => {
        if (candidate) {
            send({
                opCode: "RTC",
                data: {
                    type: "CANDIDATE",
                    candidate
                }
            });
        }
    }

    peerConnection.ontrack = ({ streams: [stream] }) => {
        let remoteAudio = document.getElementById(`remoteAudio-${id}`);
        if (!remoteAudio) {
            remoteAudio = document.createElement("audio");
            remoteAudio.id = `remoteAudio-${id}`;
            remoteAudio.autoplay = true;
            document.getElementById("remoteAudios").appendChild(remoteAudio);
        }
        remoteAudio.srcObject = stream;
    }

    connections[id] = peerConnection;
}

function createOffer(){
    Object.keys(connections).every(async peer =>{
        const peerConnection = connections[peer];
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
        send({
            opCode: "RTC",
            data: {
                type: "OFFER",
                offer,
                target: peer
            }
        });
        voiceChannelState.innerText = "RTC connecting: ";
        voiceChannelState.style.color = "#cc0";
    });
}

function createAnswer(id, offer){
    return new Promise(async res =>{
        let peerConnection = connections[id];
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
        if (id in iceCache) {
            for (const candidate of iceCache[id]) {
                await peerConnection.addIceCandidate(candidate);
            }
            delete iceCache[id];
        }
        voiceChannelState.innerText = "Connected: ";
        voiceChannelState.style.color = "#0c0";
        res(answer);
    });
}

async function receiveAnswer(id, answer){
    let peerConnection = connections[id];
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    if (id in iceCache) {
        for (const candidate of iceCache[id]) {
            await peerConnection.addIceCandidate(candidate);
        }
        delete iceCache[id];
    }
    voiceChannelState.innerText = "Connected: ";
    voiceChannelState.style.color = "#0c0";
}

function receiveCandidate(data) {
    return new Promise(async res => {
        const peerConnection = connections[data.target];
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
            if (!(data.target in iceCache)) iceCache[data.target] = [];
            iceCache[data.target].push(data.candidate);
        }
        res(true);
    });
}

let bypass = null;
function send(data){
    if(bypass !== null) data["bypass"] = bypass;
    ws.send(JSON.stringify(data));
}

let muted = false;
const micButton = document.getElementById("micButton");
const mute = document.getElementById("micMute");
const unmute = document.getElementById("micUnmute");
if(muted){
    unmute.style.display = "none";
    mute.style.display = "flex";
} else {
    mute.style.display = "none";
    unmute.style.display = "flex";
}

micButton.onclick = (e) => {
    e.preventDefault();
    muted = !muted;
    if(muted){
        unmute.style.display = "none";
        mute.style.display = "flex";
        micButton.className += " muted";
    } else {
        mute.style.display = "none";
        unmute.style.display = "flex";
        micButton.className = micButton.className.split(" muted")[0];
    }

    localStream.getAudioTracks()[0].enabled = !muted;
    send({
        opCode: "RTC",
        data: {
            type: "MUTE",
            value: muted
        }
    });
};

const leaveButton = document.getElementById("leaveButton");
const leaveIcon = document.getElementById("leaveIcon");
const leaveConfirm = document.getElementById("leaveConfirm");
leaveConfirm.style.display = "none";
leaveIcon.style.display = "flex";

leaveButton.onmouseover = (e)=>{
    e.preventDefault();
    leaveIcon.style.display = "none";
    leaveConfirm.style.display = "flex";
}
leaveButton.onmouseout = (e)=>{
    e.preventDefault();
    leaveConfirm.style.display = "none";
    leaveIcon.style.display = "flex";
}
leaveButton.onclick = (e)=>{
    e.preventDefault();
    leave();
}

document.getElementById("channelCreateButton").onclick = (e) => {
    e.preventDefault();

    console.log("CHANNEL CREATION: WIP, NOT IMPLEMENTED YET");
}

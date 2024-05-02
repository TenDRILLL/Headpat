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
    const userStatus = document.getElementById(`user_${userID}`).classList.toString().replace('user ', '').replace(' exitable', '')

    if (userID === document.headpat.currentUser.ID && editable) {
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
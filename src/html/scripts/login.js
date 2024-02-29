const toast = document.getElementById("snackbar");

function login(){

    toast.className = toast.className.replace("show", "");
    fetch("/login", {
        method: "POST",
        body: JSON.stringify({
            email: document.getElementById("email").value,
            password: document.getElementById("password").value,
            remember: document.getElementById("remember").checked
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
        .then(res => res.json())
        .then(resp => {
            if("redirect" in resp){
                document.location.href = resp.redirect;
            }
            if("data" in resp){
                if(resp.data === "2FA_REQUIRED"){
                    document.getElementById("tfa-popup").style.display = "block";
                    document.getElementById("overlay").style.display = "block";
                    document.getElementById("tfa1").focus();
                }
            }
            if("error" in resp){
                showError(resp.error);
            }
        });
}

document.getElementById("login").onclick = () => {
    login();
}

function showError(err){
    toast.className = "show";
    toast.innerHTML = err;
    setTimeout(()=>{toast.className = toast.className.replace("show", "");}, 5000);
}

for(let i = 1; i < 7; i++){
    document.getElementById(`tfa${i}`).addEventListener("input", (e)=>{
        if(e.inputType === "deleteContentBackward"){
            document.getElementById(`tfa${i-1}`).focus();
        } else {
            document.getElementById(`tfa${i+1}`).focus();
        }
    });
}

document.getElementById("tfalogin").onclick = ()=>{
    fetch("/login", {
        method: "POST",
        body: JSON.stringify({
            email: document.getElementById("email").value,
            password: document.getElementById("password").value,
            remember: document.getElementById("remember").checked,
            tfa: `${tfa1.value}${tfa2.value}${tfa3.value}${tfa4.value}${tfa5.value}${tfa6.value}`
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
        .then(res => res.json())
        .then(resp => {
            if("redirect" in resp){
                document.location.href = resp.redirect;
            }
            if("error" in resp){
                showError(resp.error);
            }
        });
};

document.getElementById("password").addEventListener("keydown", (e)=>{
    if(e.key === "Enter") {
        login();
    }
});
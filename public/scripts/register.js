const toast = document.getElementById("snackbar");

document.getElementById("register").onclick = () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const registrationCode = document.getElementById("registrationCode").value;
    fetch("/register", {
        method: "POST",
        body: JSON.stringify({
            email,
            password,
            registrationCode
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    }).then(res => res.json())
        .then(resp => {
            if("redirect" in resp){
                document.location.href = resp.redirect;
            }
            if("error" in resp){
                showError(resp.error);
            }
        });
}

function showError(err){
    toast.className = "show";
    toast.innerHTML = err;
    setTimeout(()=>{toast.className = toast.className.replace("show", "");}, 5000);
}
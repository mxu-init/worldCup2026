fetch("../assets/footer/footerInjection.html")
.then(response => response.text())
    .then(data => {
        document.getElementById("footerInjection").innerHTML = data;
    });
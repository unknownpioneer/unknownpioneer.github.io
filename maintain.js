var active = 1;
if (active == 1) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/path/to/resource', true);
    xhr.status = 502;
    xhr.send();

    window.location.href = "nope.html"
}
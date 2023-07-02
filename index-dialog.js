// 获取元素
var dialog = document.getElementById('myDialog');

// 显示对话框
function showDialog() {
    dialog.style.display = 'block';
}

// 隐藏对话框
function hideDialog() {
    dialog.style.display = 'none';
}

// 显示对话框并设置cookie
function showDialogWithCookie() {
    // 检查cookie是否存在
    if (document.cookie.indexOf('dialogShown=true') === -1) {
        // 显示对话框
        showDialog();

        // 设置cookie，有效期为1天
        var date = new Date();
        date.setTime(date.getTime() + (24 * 60 * 60 * 1000));
        var expires = '; expires=' + date.toGMTString();
        document.cookie = 'dialogShown=true' + expires + '; path=/';
    }
}

// 检查cookie是否存在，如果不存在则显示对话框
if (document.cookie.indexOf('dialogShown=true') === -1) {
    showDialog();
}

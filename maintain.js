var active = 0;
if (active == 1) {
    window.location.href = "nope.html"
}
// 定义一个特定日期，例如2023年7月15日
var specialDate = new Date(2023, 13, 13); // 注意月份是从0开始的，所以6代表7月

// 获取当前日期
var currentDate = new Date();

// 比较两个日期是否相等，忽略时间部分
var isSpecialDate = specialDate.toDateString() === currentDate.toDateString();

// 如果是特定日期，就将网站的颜色模式设为黑白
if (isSpecialDate) {
  // 获取网站的根元素
  var root = document.documentElement;

  // 设置根元素的CSS变量，将颜色模式设为黑白
  root.style.setProperty("--color-mode", "grayscale");
}

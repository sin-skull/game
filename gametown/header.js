
// 共通ヘッダーを読み込むJavaScriptコード
document.addEventListener('DOMContentLoaded', function() {
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-container').innerHTML = data;
        });
});

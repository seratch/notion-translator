javascript:(() => {
    const url = window.location.href;
    if(!/notion\.so\//.test(url)){
        alert("Translation tools are not available on sites other than notion.so");
    }
    const pageId = url.split('/').pop().split("-").pop();
    fetch(`https://notion-translate-chrome-extension-api.onrender.com?pageId=${pageId}`, {
        method: "GET",
        mode: "no-cors",
        headers: {
            'Access-Control-Allow-Origin':'*'
        }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        }
        // 404 や 500 ステータスならここに到達する
        throw new Error('Network response was not ok.');
    })
    .then(resJson => {
        console.log(resJson.newPageUrl);
        window.open(resJson.newPageUrl);
    })
    .catch(error => {
        // ネットワークエラーの場合はここに到達する
        alert(JSON.stringify(error));
    })
})();

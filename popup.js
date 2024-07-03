// TODO:  reflect 

window.onload = loaded;

const port = chrome.runtime.connect({
  name: "Sample Communication",
});
// document.addEventListener('DOMContentLoaded', function () {
//   console.log('DOMContentLoaded')
//   populate();
// })

function loaded() {
  port.postMessage("get-stuff");
  port.onMessage.addListener(function (msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      selectedId = tabs[0].id;
      listMatched(msg.matched[selectedId]);
      //listURIs(msg.requestURIs[selectedId]);
    });
  });
}

function listURIs(uris){
  const requestList = document.getElementById("request-list");
  uris?.forEach(request=>{
    requestList.innerText+=request+"\r\n";
  });
}


//change this
function listMatched(matched){
  const requestList = document.getElementById("request-list");
  const requestPaths = document.getElementById("request-paths");
  const requestParams = document.getElementById("request-params");
  const requestValues = document.getElementById("request-values");
  if(!matched) return;
  matched.path.forEach(match=>{
    let tr = document.createElement("tr");
    let td = document.createElement("td");
    td.innerText = match;
    tr.appendChild(td);
    requestPaths.appendChild(tr)
  });
  matched.param.forEach(match=>{
    let tr = document.createElement("tr");
    let td = document.createElement("td");
    td.innerText = match;
    tr.appendChild(td);
    requestParams.appendChild(tr)
  });
  matched.value.forEach(match=>{
    let tr = document.createElement("tr");
    let td = document.createElement("td");
    td.innerText = match;
    tr.appendChild(td);
    requestValues.appendChild(tr)
  });
}

function populate() {
  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    function (tabs) {
      console.log("tabs", tabs);
      chrome.storage.local.get([tabs[0].id + ""], (data) => {
        const requestList = document.getElementById("request-list");
        const requests = data[tabs[0].id + ""] || [];
        requests.forEach((request) => {
          // Create and append HTML elements to display request details
          requestList.innerText += request.request.url + "\r\n";
        });
      });
    }
  );
}

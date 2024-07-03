//console.log('loaded')
importScripts("qs.js");

var requests = {};
var requestURIs = {};
var matched = {};
var tab_push = {},
  tab_lasturl = {};
var current_url = "";
var selectedId = -1;
var samesite = true;

(async function(){
  const [tab] = await chrome.tabs.query({active: true});
  const url = tab?.[0]?.url || tab?.url;
  current_url = url || "";
})();

function refreshCount() {
  const match = matched[selectedId];
  txt = match ? match.path.length + match.param.length + match.value.length : 0;
  chrome.tabs.get(selectedId, function () {
    if (!chrome.runtime.lastError) {
      chrome.action.setBadgeText({ text: "" + txt, tabId: selectedId });
      if (txt > 0) {
        chrome.action.setBadgeBackgroundColor({
          color: [255, 0, 0, 255],
        });
      } else {
        chrome.action.setBadgeBackgroundColor({ color: [0, 0, 255, 0] });
      }
    }
  });
}

chrome.tabs.onUpdated.addListener(async function (tabId, props) {
  console.log(props);
  const [tab] = await chrome.tabs.query({active: true});
  console.log(tab?.[0]?.url);
  const url = tab?.[0]?.url || tab?.url;
  current_url = url || "";
  if (props.status == "complete") {
    if (tabId == selectedId) refreshCount();
  } else if (props.status) {
    if (tab_push[tabId]) {
      //this was a pushState, ignore
      delete tab_push[tabId];
    } else {
      //if(props.url && tab_lasturl[tabId] && props.url.split('#')[0] == tab_lasturl[tabId]) {
      //same url as before, only a hash change, ignore
      //} else
      if (!tab_lasturl[tabId]) {
        //wipe on other statuses, but only if lastpage is not set (aka, changePage did not run)
        requests[tabId] = [];
      }
    }
  }
  if (props.status == "loading") tab_lasturl[tabId] = true;
});

//chrome.runtime.onInstalled.addListener(() => {
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log("onActivated");
  selectedId = activeInfo.tabId;
  //let ID = ~~(Math.random() * (100000000 - 1000) + 100);
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [selectedId],
    addRules: [
      {
        id: selectedId,
        condition: {
          urlFilter: ".*",
          //resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
        },
        action: {
          type: "modifyHeaders",
          responseHeaders: [
            {
              header: "X-Web-Extension2",
              value: "RequestLogger",
              operation: "set",
            },
          ],
        },
      }
    ],
  });
  console.log("declarative->", chrome.declarativeNetRequest);
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.log("inside");
    let requrl, current;
    try {
      requrl = new URL(info.request.url);
      current = new URL(current_url);
    } catch (err) {
      console.log(err);
      return 1;
    }

    const reqhost = requrl.hostname;
    const currhost = current.hostname;

    const reqsplit = reqhost.split(".");
    const currsplit = currhost.split(".");

    const reqbase =
      reqsplit[reqsplit.length - 2] + "." + reqsplit[reqsplit.length - 1];
    const currbase =
      currsplit[currsplit.length - 2] + "." + currsplit[currsplit.length - 1];

    if (samesite) {
      if (reqbase !== currbase) return;
    }

    const reqpath = requrl.pathname;

    const reqpaths = requrl.pathname.split("/");
    const currpaths = current.pathname.split("/");

    const reqsearchparse = Qs.parse(requrl.search.substring(1), {
      allowDots: true,
      comma: true,
    });
    const currsearchparse = Qs.parse(current.search.substring(1), {
      allowDots: true,
      comma: true,
    });

    //const reqsearchparse0 = Qs.parse(requrl.search.substring(1), {depth: 0});
    //const currsearchparse0 = Qs.parse(current.search.substring(1), {depth: 0});

    const reqhash = requrl.hash.substring(1);
    const currenthash = current.hash.substring(1);

    let reqhashparse, currhashparse;
    if (currenthash.search(/[=&]/) !== -1) {
      reqhashparse = Qs.parse(reqhash, { allowDots: true, comma: true });
      currhashparse = Qs.parse(currenthash, { allowDots: true, comma: true });
    }

    let reqhashpaths, currhashpaths;
    if (currenthash.search(/\/|(%2f)/) !== -1 && !currhashparse) {
      reqhashpaths = reqhash.split(/\/|%2f/);
      currhashpaths = currenthash.split(/\/|%2f/);
    }

    const { keys: currks, values: currvs } = flatten(currsearchparse);
    //const {keys: currks0, values: currvs0} = flatten(currsearchparse0);
    const { keys: currhks, values: currhvs } = flatten(currhashparse || {});

    const paths = uniqueEncode(currpaths, currhashpaths);
    const parameters = uniqueEncode(currks, /*currks0,*/ currhks);
    const values = uniqueEncode(currvs, /*currvs0,*/ currhvs);

    /*
    const paths1 = [...encodeArray(currpaths), ...encodeArray(currhashpaths)];
    const parameters1 = [...new Set([...encodeArray(currks),...encodeArray(currks0),...encodeArray(currhks)])];
    const values1 = [...new Set([...encodeArray(currvs),...encodeArray(currvs0),...encodeArray(currhvs)])];
    */
    const pathMatched = arrMatches(paths, reqpath);
    const paramMatched = arrMatches(parameters, reqpath);
    const valueMatched = arrMatches(values, reqpath);

    //console.log("info->",info);
    //console.log("activeinfo->", activeInfo);
    requests[selectedId + ""] = requests[selectedId + ""] || [];
    requests[selectedId + ""].push(info);

    requestURIs[selectedId + ""] =
      new Set(requestURIs[selectedId + ""]) || new Set();
    requestURIs[selectedId + ""].add(info.request.url);
    requestURIs[selectedId + ""] = [...requestURIs[selectedId + ""]];

    if (pathMatched.length || paramMatched.length || valueMatched.length) {
      matched[selectedId + ""] = matched[selectedId + ""] || {};

      matched[selectedId + ""].path = matched[selectedId + ""].path || [];
      matched[selectedId + ""].param = matched[selectedId + ""].param || [];
      matched[selectedId + ""].value = matched[selectedId + ""].value || [];

      matched[selectedId + ""].path = [
        ...new Set(matched[selectedId + ""].path.concat(pathMatched)),
      ];
      matched[selectedId + ""].param = [
        ...new Set(matched[selectedId + ""].param.concat(paramMatched)),
      ];
      matched[selectedId + ""].value = [
        ...new Set(matched[selectedId + ""].value.concat(valueMatched)),
      ];
    }

    refreshCount();
  });
});

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  selectedId = tabs[0].id;
  refreshCount();
});

chrome.runtime.onConnect.addListener(function (port) {
  port.onMessage.addListener(function (msg) {
    port.postMessage({
      requests: requests,
      requestURIs: requestURIs,
      matched: matched,
    });
  });
});

function arrMatches(arr, search) {
  return arr.filter((str) => {
    return (
      search.indexOf(str) !== -1 &&
      search.trim() &&
      str.trim() &&
      str.length > 1
    );
  });
}

function uniqueEncode(...params) {
  return [
    ...new Set(
      encodeArray(
        params.reduce((acc, k, v) => {
          return acc.concat(k);
        }, [])
      )
    ),
  ];
}

function encodeArray(arr) {
  if (!arr || !arr.length) return [];
  return arr.reduce((acc, k, v) => {
    return acc.concat(uriencdec(k));
  }, []);
}

function uriencdec(param) {
  return [
    decodeURIComponent(decodeURIComponent(param)),
    decodeURIComponent(param),
    param,
    encodeURIComponent(param),
    encodeURIComponent(encodeURIComponent(param)),
  ];
}

function flatten(obj) {
  let result = {};
  let keys = new Set();
  let values = new Set();

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const nestedKey = key;

      if (typeof value === "object" && Object.keys(value).length === 0) {
        keys.add(nestedKey);
        continue;
      }

      if (typeof value === "object" && value !== null) {
        // If the value is an object or array, recursively call the function
        let inter = flatten(value);
        keys.add(nestedKey);
        inter.keys?.length && inter.keys.forEach((_) => keys.add(_));
        inter.values?.length && inter.values.forEach((_) => values.add(_));
      } else {
        // If the value is not an object or array, add the key and value to the result
        keys.add(nestedKey);
        values.add(value);
      }
    }
  }

  if (keys.size) result.keys = [...keys];
  if (values.size) result.values = [...values];
  return result;
}

Object.size = function(obj) {
	var size = 0, key;
	for (key in obj) {
		if (obj.hasOwnProperty(key)) size++;
	}
	return size;
};

function extractValue(doc, struct, name) {
	var elem = doc.evaluate("./member[name='"+name+"']/value", struct, null, XPathResult.ANY_TYPE, null)
		.iterateNext();
	if (elem==null) return "NOT_FOUND";
	if (elem.getElementsByTagName("base64")[0]) {
		var base64str = elem.getElementsByTagName("base64")[0].textContent;
		try {
			var str = window.atob(base64str);
			return str;
		} catch (e) {
			return base64str;
		}
	} else {
		return elem.textContent;
	}
}

var foundPosts = new Array();
var updateTimestamp;
var newPosts = new Array();
var postsWithNewComments = new Array();

function getSeenPosts() {
	var seenPosts = new Array();
	if (localStorage.seenPosts && localStorage.seenPosts!="") {
		seenPosts = JSON.parse(localStorage.seenPosts);
	}
	return seenPosts;
}

function setPostSeen(url) {
	var seenPosts = new Array();
	if (localStorage.seenPosts && localStorage.seenPosts!="") {
		seenPosts = JSON.parse(localStorage.seenPosts);
	}
	if (seenPosts.indexOf(url)==-1) {
		seenPosts.push(url);
	}
	localStorage.seenPosts = JSON.stringify(seenPosts);
}

function getSeenComments(url) {
	var seenComments = new Object;
	if (localStorage.seenComments && localStorage.seenComments!="") {
		seenComments = JSON.parse(localStorage.seenComments);
	}
	if (seenComments[url])
		return seenComments[url];
	else
		return new Object;
}

function setSeenComments(url, urlSeenComments) {
	var seenComments = new Object;
	if (localStorage.seenComments && localStorage.seenComments!="") {
		seenComments = JSON.parse(localStorage.seenComments);
	}
	seenComments[url] = urlSeenComments;
	localStorage.seenComments = JSON.stringify(seenComments);
}

function setBadgeText(numNewPosts, numNewComments) {
	var text = "";
	if (numNewPosts!=0 || numNewComments!=0) {
		if (numNewPosts>99) {
			text = "100+";
		} else if (numNewPosts>9 && numNewComments>9) {
			text = numNewPosts.toString()+"/N";
		} else if (numNewComments>99) {
			text = numNewPosts.toString()+"/N";
		} else {
			text = numNewPosts.toString()+"/"+numNewComments.toString();
		}
	}
	chrome.browserAction.setBadgeText({"text": text});
}

function setBadgeTextText(text) {
	chrome.browserAction.setBadgeText({"text": text});
}

function parseFriendsPageData(doc) {
	// see ~/lj/getfriendspage-resp.xml on isis for an example of the contents of the received XML
	var entries=doc.evaluate("/methodResponse/params/param/value/struct/member[name='entries']/value/array/data/value",
		doc, null, XPathResult.ANY_TYPE, null);
	if (entries==null) {
		console.error("XML response incorrect, doesn't include any entries?");
		return;
	}
	console.log("Parsing the XML-RPC friends page data");
	foundPosts = new Array();
	newPosts = new Array();
	postsWithNewComments = new Array();
	var foundPostIndex = 0;
	var seenPosts = getSeenPosts();
	var numNewPosts = 0;
	var numNewComments = 0;
	var entry = entries.iterateNext();
	var numPosts = 0;
	var numComments = 0;
	while (entry) {
		var struct = entry.getElementsByTagName("struct")[0];
		var siteName = extractValue(doc, struct, "journalurl");
		var journalName = extractValue(doc, struct, "journalname");
		var postId = extractValue(doc, struct, "ditemid");
		var postUrl = siteName+"/"+postId+".html";
		var subject = extractValue(doc, struct, "subject_raw");
		var comments = parseInt(extractValue(doc, struct, "reply_count"));
		if (seenPosts.indexOf(postUrl)==-1) {
			// New post:
			numNewPosts++;
			if (comments>0) numNewComments += comments;
			newPosts.push({"url": postUrl, "subject": subject, "comments": comments, "journalName": journalName});
		} else {
			var newComments = comments - Object.size(getSeenComments(postUrl));
			if (newComments<0) newComments = 0;
			if (newComments>0) {
				numNewComments += newComments;
				postsWithNewComments.push({"url": postUrl, "subject": subject, "comments": comments, "newComments": newComments, "journalName": journalName});
			}
		}
		foundPosts[foundPostIndex] = new Object;
		foundPosts[foundPostIndex].url = postUrl;
		foundPosts[foundPostIndex].subject = subject;
		foundPosts[foundPostIndex].comments = comments;
		foundPostIndex++;
		numPosts++;
		if (comments>0) numComments += comments;
		entry = entries.iterateNext();
	}
	
	console.log("Found "+numPosts+" posts ("+numNewPosts+" new) and "+numComments.toString()+" comments ("+numNewComments+" new)");
	setBadgeText(numNewPosts, numNewComments);
	
	updateTimestamp = new Date();
}

function fetchFriendsPageData() {
	var username=localStorage.username;
	var password=localStorage.password;
	message = "<?xml version=\"1.0\"?>"
		+"<methodCall>"
		+"<methodName>LJ.XMLRPC.getfriendspage</methodName>"
		+"<params><param>"
		+"<value><struct>"
		+"<member><name>username</name><value><string>"+username+"</string></value></member>"
		+"<member><name>auth_method</name><value><string>clear</string></value></member>"
		+"<member><name>password</name><value><string>"+password+"</string></value></member>"
		+"<member><name>ver</name><value><int>1</int></value></member>"
		+"<member><name>itemshow</name><value><int>40</int></value></member>"
		+"<member><name>skip</name><value><int>0</int></value></member>"
		//+"<member><name>parseljtags</name><value><int>1</int></value></member>"
		+"</struct></value>"
		+"</param></params>"
		+"</methodCall>";
		
	console.log("Fetching friends page data via XML-RPC");
	
	var client = new XMLHttpRequest();
	client.onreadystatechange = function() {
		if (this.readyState==4 && this.status==200 && this.responseXML!=null) {
			parseFriendsPageData(this.responseXML);
		}
	};
	client.open("POST", "http://www.livejournal.com/interface/xmlrpc");
	client.setRequestHeader("Content-Type", "text/xml; charset=UTF-8");
	client.send(message);
}

function fakeFriendsPageData() {
	var client = new XMLHttpRequest();
	client.open("GET", "getfriendspage-resp-raw.xml", false);
	client.send("");
	parseFriendsPageData(client.responseXML);
}

function onRequest(request, sender, callback) {
	if (request.action=="getSeenCommentCount") {
		var callbackData = request.callbackData;
		callbackData.url = request.url;
		callbackData.seenCommentCount = Object.size(getSeenComments(request.url));
		if (callback) callback(callbackData);
	} else if (request.action=="getSeenComments") {
		var callbackData = new Object;
		callbackData.url = request.url;
		callbackData.seenComments = getSeenComments(request.url);
		if (callback) callback(callbackData);
	} else if (request.action=="setSeenComments") {
		setSeenComments(request.url, request.urlSeenComments);
		if (callback) callback(null);
	} else if (request.action=="getSeenPosts") {
		var callbackData = new Object;
		callbackData.seenPosts = getSeenPosts();
		if (callback) callback(callbackData);
	} else if (request.action=="setPostSeen") {
		setPostSeen(request.url);
		if (callback) callback(null);
	} else if (request.action=="fetchFriendsPageData") {
		fetchFriendsPageData();
		if (callback) callback(null);
	} else if (request.action=="getNewItems") {
		var response = new Object;
		response.newPosts = newPosts;
		response.postsWithNewComments = postsWithNewComments;
		if (callback) callback(response);
	}
}

chrome.extension.onRequest.addListener(onRequest);

var requestTimeout = null;

function scheduleRequest() {
	if (requestTimeout) {
		window.clearInterval(requestTimeout);
	}

	var interval = localStorage.interval;// in ms
	if (!interval) interval = 300000; // Default 5 min
	console.log('Scheduling request in ' + interval + 'ms');
	requestTimeout = window.setTimeout(startRequest, interval);
}

function startRequest() {
	fetchFriendsPageData();
	scheduleRequest();
}

setBadgeTextText("...");
startRequest();

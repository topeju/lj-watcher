Object.size = function(obj) {
	var size = 0, key;
	for (key in obj) {
		if (obj.hasOwnProperty(key)) size++;
	}
	return size;
}

function getElementsByClass(context, tagName, className) {
	var retVal = Array();
	var retValIndex = 0;
	for (var i=0; i<context.childNodes.length; i++) {
		if (context.childNodes[i].getAttribute) {
			var cl = context.childNodes[i].getAttribute("class");
			if (cl != null && cl.indexOf(className) != -1) {
				retVal[retValIndex++] = context.childNodes[i];
			}
		}
	}
	return retVal;
}

function getFirstElementByClass(context, tagName, className) {
	var retVal = null;
	for (var i=0; (i<context.childNodes.length) && (retVal==null); i++) {
		var n = context.childNodes[i];
		if (n.getAttribute!=null) {
			var cl = n.getAttribute("class");
			if (cl != null && cl.indexOf(className) != -1) {
				retVal = context.childNodes[i];
			}
		}
	}
	return retVal;
}

function getSeenPosts(callback) {
	chrome.extension.sendRequest({'action': 'getSeenPosts'}, callback);
}

function setPostSeen(url) {
	chrome.extension.sendRequest({'action': 'setPostSeen', 'url': url});
}

function getSeenCommentCount(url, callbackData, callback) {
	chrome.extension.sendRequest({'action': 'getSeenCommentCount', 'url': url, 'callbackData': callbackData}, callback);
}

function getSeenComments(url, callback) {
	chrome.extension.sendRequest({'action': 'getSeenComments', 'url': url}, callback);
}

function setSeenComments(url, urlSeenComments) {
	chrome.extension.sendRequest({'action': 'setSeenComments', 'url': url, 'urlSeenComments': urlSeenComments});
}

var newEntries = new Array();
var currentEntry = -1;

function checkPosts() {
	getSeenPosts(function(response) {
		var seenPosts = response.seenPosts;
		var body = document.getElementById("body");
		if (!body) return;
		var entries = getElementsByClass(body, "div", "box");
		var commentCountRegExp = /[?]nc=([0-9]*)/;
		commentCountRegExp.compile(commentCountRegExp);
		var timeout=0;
		for (var i=0; i<entries.length; i++) {
			var entry = entries[i];
			var talklinks = getFirstElementByClass(entry, "div", "talklinks");
			var permalink = talklinks.getElementsByTagName("div")[0];
			var href=permalink.getElementsByTagName("a")[0].getAttribute("href");
			var links = talklinks.getElementsByTagName("a");
			var foundComments = false;
			// By default, all posts are either new or have new comments. Others will be removed later:
			newEntries.push(entry);
			for (var j=0; j<links.length; j++) {
				var linkUrl=links[j].getAttribute("href");
				var nc = linkUrl.match(commentCountRegExp);
				if (nc != null) {
					// This is the link we're looking for.
					foundComments = true;
					var commentCount = nc[1];
					getSeenCommentCount(href,
						{'commentCount': nc[1], 'i': i, 'j': j},
						function(response) {
							var seenCommentCount = response.seenCommentCount;
							var newComments = response.commentCount - seenCommentCount;
							if (newComments<0) newComments = 0;
							var entry = getElementsByClass(document.getElementById("body"), "div", "box")[response.i];
							var linkElem = getFirstElementByClass(entry, "div", "talklinks")
								.getElementsByTagName("a")[response.j];
							linkElem.textContent = response.commentCount + " comments (" + newComments + " new)";
							if (newComments>0) {
								setPostSeen(response.url);
							} else {
								console.log(response.url+" has no new comments");
								var entryIndex = newEntries.indexOf(entry);
								newEntries.splice(entryIndex, 1);
							}
							currentEntry=-1;
						});
				}
			}
			if (!foundComments) {
				// If this particular post (that doesn't have any comments yet) hasn't been
				// seen previously, add it as a link to the new entries list, and mark it as seen:
				if (seenPosts.indexOf(href)==-1) {
					setPostSeen(href);
				} else {
					console.log(href+" has no comments but has been seen already");
					var entryIndex = newEntries.indexOf(entry);
					newEntries.splice(entryIndex, 1);
				}
			}
		}
		console.log("Before parsing read comments, there are "+newEntries.length+" potentially updated posts available");
	});
}

function isDigit(chr) {
	if (chr.length>1) { return false; }
	var allDigits="1234567890";
	if (allDigits.indexOf(chr) != -1) { return true; }
	return false;
}

function checkPageComments() {
	// Get the URL of the current page, and strip out any parameters on it (nc=NN, style=mine, etc)
	var url = document.URL.replace(/[?].*/, "");

	// Comments on LJ pages are inside <div id="comments">. If this cannot be found, abort:
	if (!document.getElementById("multiform")) return;

	// Get the list of seen comments on this page from the background page:
	var seenComments = getSeenComments(url, function(response) {
		var seenComments = response.seenComments;
		
		console.log(Object.size(seenComments) + " comments on page " + response.url
			+ " seen earlier");

		// Comments on LJ pages are inside <div class="b-tree-root">:
		var commentDiv = document.getElementById("multiform");
		
		var treeRoot = getFirstElementByClass(commentDiv, "div", "b-tree-root");

		// Each comment is inside a <div class="b-tree-twig"> segment, each of which has its own id.
		// The ids are stored in localStorage.seenComments[page_url][] so we know which ones have been seen
		// and which haven't.
		var commentSpans = getElementsByClass(treeRoot, "div", "b-tree-twig");
		
		console.log("Page now has " + commentSpans.length + " comments, starting to cross-reference them with previously seen comments");

		newEntries = new Array();
		for (var i=0; i<commentSpans.length; i++) {
			var id = commentSpans[i].getAttribute("data-tid");
			if (id != null && !seenComments[id]) {
				var leaf = getFirstElementByClass(commentSpans[i], "div", "b-leaf");
				if (leaf != null) {
					seenComments[id]=1;
					newEntries.push(leaf);
					console.log("New comment id: " + id);
				}
			}
		}

		// Store seenComments back into localStorage on the background page:
		setSeenComments(response.url, seenComments);
		setPostSeen(response.url);
	});
	
}

console.log("Starting to process page for posts");
checkPosts();
console.log("Post list processed");

console.log("Starting to process comments on page");
checkPageComments();
console.log("Comments processed.");

var previousStyle;

// If this page has a "Comments" div, add keyboard navigation for comments:
document.onkeypress = function(e) {
	var t = e.target;
	if (t && t.nodeName && (t.nodeName == "INPUT" || t.nodeName == "SELECT" || t.nodeName == "TEXTAREA")) return;
	if (e.ctrlKey || e.altKey  || e.ctrlKey  || e.metaKey  || e.shiftKey) return;
	var key = e.keyCode ? e.keyCode : e.which;
	console.log("onkeypress: "+key);
	if (key == 107) { // "k" key:
		if (currentEntry>=0 && currentEntry<newEntries.length) {
			newEntries[currentEntry].style.border=previousStyle;
		}
		if (currentEntry > 0) {
			currentEntry--;
			newEntries[currentEntry].scrollIntoView();
		} else {
			currentEntry = -1;
			if (document.getElementById("comments"))
				document.getElementById("comments").scrollIntoView();
			else
				document.getElementById("body").scrollIntoView();
		}
		if (currentEntry>=0 && currentEntry<newEntries.length) {
			previousStyle = newEntries[currentEntry].style.border;
			newEntries[currentEntry].style.border="thick solid black";
		}
	}
	if (key == 106) { // "j" key:
		if (currentEntry>=0 && currentEntry<newEntries.length) {
			newEntries[currentEntry].style.border=previousStyle;
		}
		if (currentEntry < (newEntries.length-1)) {
			currentEntry++;
			newEntries[currentEntry].scrollIntoView();
		} else {
			if (newEntries.length>0) {
				currentEntry = newEntries.length-1;
				newEntries[currentEntry].scrollIntoView
			} else {
				if (document.getElementById("Comments"))
					document.getElementById("Comments").scrollIntoView();
				else
					document.getElementById("body").scrollIntoView();
			}
		}
		if (currentEntry>=0 && currentEntry<newEntries.length) {
			previousStyle = newEntries[currentEntry].style.border;
			newEntries[currentEntry].style.border="thick solid black";
		}
	}
	if (key == 108) {
		console.log("Debug: currentEntry="+currentEntry+", newEntries.length="+newEntries.length);
		for (var i=0; i<newEntries.length; i++) {
			console.log("Debug: newEntries["+i+"]="+newEntries[i]);
		}
	}
}

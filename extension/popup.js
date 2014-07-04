var newPosts = new Array();
var postsWithNewComments = new Array();

function newInTabs() {
	console.log("Opening new items in tabs: " + newPosts.length + " posts, " + postsWithNewComments.length + " comments");
	for (var i in newPosts) {
		var p = newPosts[i];
		chrome.tabs.create({"url": p.url+"?nc="+p.comments.toString()+"&style=mine", "active": true});
	}
	for (var i in postsWithNewComments) {
		var p = postsWithNewComments[i];
		chrome.tabs.create({"url": p.url+"?nc="+p.comments.toString()+"&style=mine", "active": true});
	}
}

function updatePostData() {
	console.log("Requesting information on new items from the background page");
	chrome.extension.sendRequest({'action': 'getNewItems'}, function(response) {
		newPosts = response.newPosts;
		postsWithNewComments = response.postsWithNewComments;
		
		console.log("Received " + newPosts.length + " new posts, " + postsWithNewComments.length + " old posts with new comments");
		
		if (newPosts && newPosts.length) {
			var htmlString = "<ul>";
			for (var i in newPosts) {
				var p = newPosts[i];
				console.log(" New post: "+p.url);
				var subj = p.subject;
				if (subj == "") subj="(no subject)";
				htmlString = htmlString + "<li>" + p.journalName + ": <a href=\"" + p.url + "?nc=" + p.comments.toString() + "&amp;style=mine\" target=\"_blank\">" + subj + "</a> (" + p.comments.toString() + " comments)</li>";
			}
			htmlString = htmlString + "</ul>";
			document.getElementById("newPosts").innerHTML = htmlString;
		} else {
			document.getElementById("newPosts").innerHTML = "";
		}

		if (postsWithNewComments && postsWithNewComments.length) {
			htmlString = "<ul>";
			for (var i in postsWithNewComments) {
				var p = postsWithNewComments[i];
				console.log(" Old post: "+p.url);
				var subj = p.subject;
				if (subj == "") subj="(no subject)";
				htmlString = htmlString + "<li>" + p.journalName + ": <a href=\"" + p.url + "?nc=" + p.comments.toString() + "&amp;style=mine\" target=\"_blank\">" + subj + "</a> (" + p.comments.toString() + " comments, "+ p.newComments.toString() +" new)</li>";
			}
			htmlString = htmlString + "</ul>";
			document.getElementById("newComments").innerHTML = htmlString;
		} else {
			document.getElementById("newComments").innerHTML = "";
		}

	});
}

window.addEventListener("load", function() {
	updatePostData();
	document.getElementById("allItems").addEventListener("click", newInTabs, false);
}, false);

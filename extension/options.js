// Saves options to localStorage.
function save_options() {
	localStorage.username=document.getElementById("username").value;
	localStorage.password=document.getElementById("password").value;
	localStorage.interval=document.getElementById("interval").value;

	console.log("Saved username=" + localStorage.username + " with the password specified");

	// Update status to let user know options were saved.
	var status = document.getElementById("status");
	status.innerHTML = "Options Saved.";
	setTimeout(function() {
		status.innerHTML = "";
	}, 750);
}

// Restores select box state to saved value from localStorage.
function restore_options() {
	var username = localStorage.username;
	if (username) document.getElementById("username").value = username;
	var password = localStorage.password;
	if (password) document.getElementById("password").value = password;
	var interval = localStorage.interval;
	if (interval) document.getElementById("interval").value = interval;
}

window.addEventListener("load", function() {
	console.log("Added load event listener");
	restore_options();
	document.getElementById("button").addEventListener("click", save_options, false);
}, false);

console.log("Ran options.js");


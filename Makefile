
run:
	clear
	node --env-file=.env src/app/app.js

local:
	clear
	node --env-file=.local.env src/app/app.js

import Logger, { LoggerOptions } from "@ptkdev/logger";

const options :LoggerOptions= {
	language: "en",
	colors: true,
	debug: true,
	info: true,
	warning: true,
	error: true,
	sponsor: true,
	write: true,
	type: "log",
	rotate: {
		size: "10M",
		encoding: "utf8",
	},
	path: {
		// remember: add string *.log to .gitignore
		debug_log: "./debug.log",
		error_log: "./errors.log",
	},"palette": {
		"info": {
			"label": "#ffffff", // label on left
			"text": "#2ECC71",  // log message
			"background": "#2ECC71" // background
		},
		"warning": {
			"label": "#ffffff",
			"text": "#FF9800",
			"background": "#FF9800"
		},
		"error": {
			"label": "#ffffff",
			"text": "#FF5252",
			"background": "#FF5252"
		},
		"stackoverflow": {
			"label": "#ffffff",
			"text": "#9C27B0",
			"background": "#9C27B0"
		},
		"docs": {
			"label": "#ffffff",
			"text": "#FF4081",
			"background": "#FF4081"
		},
		"debug": {
			"label": "#ffffff",
			"text": "#1976D2",
			"background": "#1976D2"
		},
		"sponsor": {
			"label": "#ffffff",
			"text": "#607D8B",
			"background": "#607D8B"
		}, 
	}
};

const logger = new Logger(options);

export  {
    logger
}
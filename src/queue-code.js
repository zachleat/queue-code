// How long after deleted character is typed before it can be removed and the next character typed
const DELETED_CHAR_DELAY = 1000; // ms

class Typer {
	constructor(slideEl) {
		this.slide = slideEl;
		this.paused = false;

		this.classes = {
			letter: "charwrap",
			cursor: "charwrap-cursor",
			cursorEmpty: "charwrap-cursor-empty",
			cursorInitial: "charwrap-cursor-initial",
			cursorEnabled: "charwrap-cursor-enabled",
			typed: "charwrap-typed",
			typedInitial: "charwrap-typed-initial",
			deleted: "charwrap-deleted",
			finished: "charwrap-finished",
		};
		this.selectors = {
			typed: `.${this.classes.letter}.${this.classes.typed}:not(.${this.classes.typedInitial})`,
			notTyped: `.${this.classes.letter}:not(.${this.classes.typed})`
		};

		this.initializeCursors();
	}
	
	initializeCursors() {
		if(!this.hasCursor()) {
			let initialCursors = Array.from(document.querySelectorAll(`.${this.classes.cursorInitial}`));
			if(initialCursors.length) {
				for(let cursor of initialCursors) {
					this.addCursor(cursor);
				}
			} else {
				this.setupInitialCursor(true);
			}
		}
	}

	hasNext() {
		return !!document.querySelector(this.selectors.notTyped);
	}

	_getNextCharacters(characterCount = 1) {
		// TODO lol performance of this is probably not great
		let untypedCharactersAndCursors = Array.from(document.querySelectorAll(`${this.selectors.notTyped},.${this.classes.cursor}`));
		let results = [];
		let cursors = [];
		let countAfterCursor = 0;
		for(let char of untypedCharactersAndCursors) {
			if(char.classList.contains(this.classes.cursor)) {
				countAfterCursor = 0;
				cursors.push(char);
			} else {
				if(countAfterCursor < characterCount) {
					results.push(char);
				}
				countAfterCursor++;
			}
		}

		return {
			next: results,
			previousCursors: cursors
		};
	}
	
	hasPrevious() {
		return !!document.querySelector(this.selectors.typed);
	}

	_getPreviousCharacters() {
		let characterCount = 1;
		// TODO lol performance of this is probably not great
		let typedCharactersAndCursors = Array.from(document.querySelectorAll(`${this.selectors.typed}:not(.${this.classes.typedInitial}),.${this.classes.cursor}:not(.${this.classes.typedInitial})`));
		typedCharactersAndCursors.reverse();

		let results = [];
		let cursors = [];
		let newCursors = [];
		let countAfterCursor = 0;
		for(let char of typedCharactersAndCursors) {
			if(char.classList.contains(this.classes.cursor)) {
				countAfterCursor = 0;
				cursors.push(char);
			}
			if(countAfterCursor < characterCount) {
				results.push(char);
			} else if(countAfterCursor === characterCount) {
				newCursors.push(char);
			}
			countAfterCursor++;
		}

		results.reverse();
		return {
			previous: results,
			newCursors: newCursors,
			previousCursors: cursors
		};
	}

	hasCursor() {
		return !!document.querySelector(`.${this.classes.cursor}`);
	}

	setupInitialCursor(add = true) {
		if(this.hasNext()) {
			if(!this._firstCodeElement) {
				this._firstCodeElement = document.querySelector(`pre > code`);
			}
	
			if(this._firstCodeElement) {
				this._firstCodeElement.classList[add ? "add" : "remove"](this.classes.cursorEmpty);
			}
		}
	}

	removeCursors(elArr) {
		for(let el of elArr) {
			el.classList.remove(this.classes.cursor);
		}

		this.setupInitialCursor(false);
	}

	addCursor(el) {
		if(el) {
			el.classList.add(this.classes.cursor);
		}
	}
	
	pauseFor(timeout = 100, afterCallback = () => {}) {
		this.paused = true;
		setTimeout(() => {
			this.paused = false;
			afterCallback();
		}, timeout)
	}
	
	getDeleteDelay() {
		let slideDelay = this.slide.getAttribute("data-slide-delete-delay");
		if(slideDelay === undefined) {
			return DELETED_CHAR_DELAY;
		}
		return slideDelay;
	}

	next(characterCount) {
		let usingMultipleCursors = this.slide.classList.contains("slide-cursors-multiple");
		let usingFunMode = this.slide.classList.contains("slide-fun-mode");
		let obj = this._getNextCharacters(characterCount);

		if(obj.next.length) {
			this.removeCursors(obj.previousCursors);

			let count = 0;
			for(let el of obj.next) {
				// Special character for hardcoded deletes
				if(el.innerHTML === "␡") {
					let deletedChar = el.previousElementSibling;
					deletedChar.classList.add(this.classes.deleted);
					el.remove();

					this.pauseFor(this.getDeleteDelay(), () => {
						deletedChar.remove();
					});
				}

				el.classList.add(this.classes.typed);

				// fun mode
				if(usingFunMode) {
					el.style.transform = `rotate(${Math.round(Math.random()*20) - 10}deg) scale(${Math.min(Math.random()+1, 1.5)})`;
				}
				
				// important if characterCount > 1 (don’t want to add cursors to all characters)
				if(usingMultipleCursors || count === obj.next.length - 1) {
					this.addCursor(el);
				}
				count++;

				if(obj.next.length - 1 === count) {
					el.scrollIntoView();
				}
			}
			this.insertOutputHtml();
		} else {
			this.finish();
		}
	}
	
	previous() {
		let obj = this._getPreviousCharacters();
		this.removeCursors(obj.previousCursors);

		if(obj.previous.length) {
			for(let el of obj.previous) {
				el.classList.remove(this.classes.typed);
			}
			this.insertOutputHtml();
		}
		if(obj.newCursors.length) {
			for(let el of obj.newCursors) {
				this.addCursor(el);
			}
		} else {
			this.initializeCursors();
		}
	}
	
	finish() {
		document.documentElement.classList.add(this.classes.finished);
	}
	
	unfinish() {
		document.documentElement.classList.remove(this.classes.finished);
	}


	autoplayNext(autoplaySpeed = 1) {
		// no cursor while it’s autoplaying
		this.toggleCursor(false);
		requestAnimationFrame(() => {
			this.next(autoplaySpeed);
			if(this.hasNext()) {
				this.autoplayNext(autoplaySpeed);
			} else {
				this.toggleCursor(true);
				this.finish();
			}
		})
	}

	toggleCursor(state) {
		document.documentElement.classList.toggle(this.classes.cursorEnabled, state);
	}

	onkeypress(code, event) {
		if( code === 32 ) { //space
			event.preventDefault();
			return;
		}
		if( code >= 37 && code <= 40 || // arrows
			code === 9 || // tab
			event.altKey ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ) {
			return;
		}
		
		if( code === 192 ) { // tilde
			this.autoplayNext(99999);
		}

		if( code === 8 ) {
			if(event) {
				event.preventDefault();
			}
			this.unfinish();
			this.previous();
		} else if( !this.paused ) {
			if(event) {
				event.preventDefault();
			}
			this.next();
		}
	}

	addSyntaxHighlighting(engine, shortcodeName) {
		let shortcodeFn = function(content, lang) {
			if(lang === "js") {
				lang = "javascript";
			}

			return `<pre class="language-${lang}"><code>${window.Prism.highlight(content.trim(), Prism.languages[lang], lang)}</code></pre>`;
		}
		engine.registerTag(shortcodeName, {
			parse: function (tagToken, remainTokens) {
				this.name = tagToken.name;
				this.args = tagToken.args;
				this.templates = [];

				var stream = engine.parser
					.parseStream(remainTokens)
					.on("template", tpl => {
						this.templates.push(tpl);
					})
					.on("tag:end" + shortcodeName, () => stream.stop())
					.on("end", () => {
						throw new Error(`tag ${tagToken.raw} not closed`);
					});

				stream.start();
			},
			render: function* (ctx) {
				const html = yield this.liquid.renderer.renderTemplates(
					this.templates,
					ctx
				);

				return shortcodeFn.call(
					ctx,
					html,
					this.args
				);
			},
		})
	}

	async renderLiquid(content, data = {}) {
		let { Liquid } = await import("/static/liquid.js");
		
		window.Prism = window.Prism || {};
		window.Prism.manual = true;
		await import("/static/prism.js");

		let engine = new Liquid({
			extname: '.html',
			cache: true
		});
		
		this.addSyntaxHighlighting(engine, "highlight");
		this.addSyntaxHighlighting(engine, "highlightCharacterWrap");

		let parsed = await engine.parse(content, "/");
		// console.log( ">>> PARSED", parsed );
		let html = await engine.render(parsed, data, {
			root: "/"
		});
		// console.log( ">> RENDER", html );
		return html;
	}

	async insertOutputHtml() {
		let pre = this.slide.querySelector(":scope pre");
		let iframe = document.querySelector("iframe");
		if(pre && iframe && !iframe.hasAttribute("data-external-iframe")) {
			let cloned = pre.cloneNode(true);
			let untypedLetters = cloned.querySelectorAll(this.selectors.notTyped);
			for(let letter of untypedLetters) {
				letter.remove();
			}
			let brs = cloned.querySelectorAll("br");
			// add line breaks because <br> won’t show up in textContent
			for(let br of brs) {
				br.before(document.createTextNode("\n"));
			}
			let content = cloned.textContent;
			let templateLanguage = this.slide.getAttribute("data-slide-template-lang");
			if(templateLanguage) {
				try {
					content = await this.renderLiquid(content);
				} catch(e) {
					console.warn( "Render error", e );
				}
			}

			content = content.split("~/twitter/@").join("https://unavatar.now.sh/twitter/");

			// throttle it
			requestAnimationFrame(async () => {
				iframe.srcdoc = content;
			});
		}
	}
}

;(function() {
	let slideEl = document.querySelector("body");
	if(!slideEl) {
		return;
	}

	let typer = new Typer(slideEl);
	if(slideEl.classList.contains("slide-autoplay")) {
		setTimeout(() => {
			typer.insertOutputHtml();
			typer.autoplayNext(slideEl.getAttribute("data-slide-autoplay-speed"));
		}, 150);
	} else {
		typer.toggleCursor(true);
		typer.insertOutputHtml();
	}

	document.addEventListener("keydown", function(e) {
		var which = e.which || e.keyCode || e.charCode;
		typer.onkeypress(which, e);
	});
})();

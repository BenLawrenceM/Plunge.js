(function($) {
	// Creates a new Plunge object that will move as the user scrolls down the page.
	$.plunge = function(options, scrollParent) {
		/* We expect the options to look something like this:
			{
				style: { width: 200, height: 100 },
				transitions: [
					{ style: { backgroundColor: "red" } },
					{ at: 300, style: { backgroundColor: "blue" } },
					{ at: 700, vertical: true, style: { backgroundColor: "yellow" } }
				],
				position: function(t) {
					return { top: 2*t, left: 2*t };
				}
			}
		   These options would create a 200x100 red box that scrolled
		   diagonally across the screen and turned blue once it reached the
		   got 300px down the page and then yellow once it reached 700px on the
		   right side of the page.
		*/

		//sanitize the input
		var settings = $.extend({
			'style': null,
			'transitions': null,
			'position': null
		}, options);
		if(settings.transitions == null) {
			settings.transitions = [];
		}
		if(settings.position == null) {
			settings.position = function(t) { return { 'top': 0, 'left': 0 } };
		}
		if(typeof scrollParent == 'undefined' || scrollParent == null) {
			scrollParent = window;
		}

		/* We're attempting to create this structure:
			<div class="plunge-container">
				<div class="plunge-transition>
					<div class="plunge-slider">
						<div class="plunge-icon"></div>
					</div>
				</div>
				<div class="plunge-transition>
					...
				</div>
				...
			</div>

		   Where:
			* plunge-container is the base element we move around the screen by
			  styling it with the results of the settings.position function
			* plunge-transition represents one item in the settings.transitions
			  array. We can change this element's height or width to hide or
			  show however much of its children we'd like to show
			* plunge-slider is an element we nudge up and down to control what
			  part of its child is seen after we change the plunge-transition's
			  height or width.
			* plunge-icon is just a div styled to the user's liking
		*/

		//create the plunge-container element to hold the transitions
		var plungeContainer = $('<div class="plunge-container"></div>');
		if(settings.style != null) {
			if(typeof settings.style == 'string') {
				plungeContainer.addClass(settings.style);
			}
			else {
				plungeContainer.css("position", "absolute").css(settings.style);
			}
		}

		//create transition elements
		var height = plungeContainer.height();
		var width = plungeContainer.width();
		var bounds = [];
		for(var i = 0; i < settings.transitions.length; i++) {
			//create the plunge-transition element
			var plungeTransition = $('<div class="plunge-transition"></div>')
					.appendTo(plungeContainer)
					.css({
						'position': "absolute",
						'top': "0",
						'left': "0",
						'width': "" + width + "px",
						'height':  "" + height + "px",
						'overflow': "hidden"
					})
					.hide();

			//create the plunge-slider element
			var plungeSlider = $('<div class="plunge-slider"></div>')
					.appendTo(plungeTransition)
					.css({
						'position': "relative",
						'top': "0",
						'left': "0",
						'width': "" + width + "px",
						'height':  "" + height + "px"
					});

			//create the plunge-icon element
			var plungeIcon = $('<div class="plunge-icon"></div>')
					.appendTo(plungeSlider)
					.css({
						'width': "" + width + "px",
						'height':  "" + height + "px",
					});

			//add class to plunge-icon element
			if(typeof settings.transitions[i].style == 'string') {
				plungeIcon.addClass(settings.transitions[i].style);
			}

			//add styles to plunge-icon element
			else {
				plungeIcon.css(settings.transitions[i].style);
			}

			//compute the top and left bounds of this transition
			var transitionBounds = {
				'top': bounds.length == 0 ? null : bounds[bounds.length-1].top,
				'bottom': null,
				'left': null,
				'right': null,
				'vertical': (settings.transitions[i].vertical === true)
			};
			if(typeof settings.transitions[i].at == 'number') {
				if(transitionBounds.vertical) {
					transitionBounds.left = settings.transitions[i].at;
				}
				else {
					transitionBounds.top = settings.transitions[i].at;
				}
			}
			bounds.push(transitionBounds);
		}

		//interpolate the right and bottom bounds of the transitions (and fix left bounds if necessary)
		var bottom = null;
		for(var i = bounds.length - 2; i >= 0; i--) {
			//if the transition after this has a vertical bound (left or right)...
			if(bounds[i + 1].vertical) {
				//set this transition's right bound to that transition's left bound (makes sense)
				if(bounds[i + 1].left == null) {
					bounds[i].right = 0;
					bounds[i + 1].left = 0;
				}
				else {
					bounds[i].right = bounds[i + 1].left;
				}
			}

			//if the transition after this has a horizontal bound (top or bottom)...
			else {
				//set this transition's bottom bound to that transition's top bound (makes sense)
				bounds[i].bottom = bounds[i + 1].top;
			}

			//if this transition has a bottom bound...
			if(bounds[i].bottom != null) {
				//record it
				bottom = bounds[i].bottom;
			}
			else {
				//otherwise set the bottom bound to the recorded bottom bound
				bounds[i].bottom = bottom;
			}
			//this block has the effect of ensuring only the last transition extends to the bottom of the screen
		}

		//add scroll handler
		var handler = createScrollHandler(plungeContainer[0], settings.position, bounds);
		$(scrollParent).bind('scroll.plunge', handler);

		//make sure we clean up if the plunge-container is destroyed
		plungeContainer.bind('destroyed.plunge', createUnbindHandler(scrollParent, handler));

		//call scroll handler once to put the element in its initial position
		handler.call(scrollParent);

		//return plunge element
		return plungeContainer;
	}

	function createUnbindHandler(scrollParent, scrollHandler) {
		return function() {
			$(scrollParent).unbind("scroll.plunge", scrollHandler);
		};
	}

	function createScrollHandler(plungeContainer, position, bounds) {
		return function() {
			//calculate the position of the plunge-container based on the distance the user has scrolled
			var t = $(this).scrollTop();
			var pos = position(t);
			var x = pos.left;
			var y = pos.top;

			//store the height and width of the plunge-container
			var height = $(plungeContainer).height();
			var width = $(plungeContainer).width();

			//move the plunge-container to its new position
			$(plungeContainer).css({
				'top': y + "px",
				'left': x + "px"
			});

			//for each transition, calculate how it should be displayed
			var plungeTransitions = $(plungeContainer).children('.plunge-transition');
			for(var i = 0; i < plungeTransitions.length; i++) {
				var plungeTransition = $(plungeTransitions[i]);

				//if the transition is inside its bounds or even clipping its bounds, it needs to be drawn
				if((bounds[i].top == null || y + height > bounds[i].top)
						&& (bounds[i].bottom == null || y < bounds[i].bottom)
						&& (bounds[i].left == null || x + width > bounds[i].left)
						&& (bounds[i].right == null || x < bounds[i].right)) {
					plungeTransition.show();
					var plungeSlider = plungeTransition.children('.plunge-slider');

					//calculate whether the transition is clipping its bounds--if it is, we need to only display portion of the icon
					var isClippingTopBound = (bounds[i].top != null && y < bounds[i].top),
						isClippingBottomBound = bounds[i].bottom != null && (y + height > bounds[i].bottom),
						isClippingLeftBound = (bounds[i].left != null && x < bounds[i].left),
						isClippingRightBound = bounds[i].right != null && (x + width > bounds[i].right);

					if(isClippingTopBound) {
						//if clipping both the bottom and top bounds
						if(isClippingBottomBound) {
							//the height displayed is just the difference between the two
							plungeTransition.height((bounds[i].bottom - bounds[i].top) + "px");
						}
						else {
							//otherwise reduce the height by the amount of vertical space clipped
							plungeTransition.height((height + y - bounds[i].top) + "px");
						}
						//if clipping the top bound, nudge the transition down to only display the bottom
						plungeTransition.css('top', (bounds[i].top - y) + "px");
						//nudge the slider up an equal amount
						plungeSlider.css('top', (y - bounds[i].top) + "px");
					}
					else {
						//if only clipping the bottom bound
						if(isClippingBottomBound) {
							//the height is the distance from the bottom bound to the top of the transition
							plungeTransition.height((bounds[i].bottom - y) + "px");
						}
						else {
							//otherwise, if clipping neither the top or bottom bound, the height is just the height!
							plungeTransition.height(height + "px");
						}
						//no nudging necessary--the reduced height will make the transition appear to vanish upwards
						plungeTransition.css('top', "0");
						plungeSlider.css('top', "0");
					}

					//see section above on vertical bounds for comments
					if(isClippingLeftBound) {
						if(isClippingRightBound) {
							plungeTransition.width((bounds[i].right - bounds[i].left) + "px");
						}
						else {
							plungeTransition.width((width + x - bounds[i].left) + "px");
						}
						plungeTransition.css('left', (bounds[i].left - x) + "px");
						plungeSlider.css('left', (x - bounds[i].left) + "px");
					}
					else {
						if(isClippingRightBound) {
							plungeTransition.width((bounds[i].right - x) + "px");
						}
						else {
							plungeTransition.width(width + "px");
						}
						plungeTransition.css('left', "0");
						plungeSlider.css('left', "0");
					}
				}

				//if the transition is entirely outside of its bounds, just hide it
				else {
					plungeTransition.hide();
				}
			}
		};
	}
})(jQuery);
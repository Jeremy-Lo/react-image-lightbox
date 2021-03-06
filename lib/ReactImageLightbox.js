/*
 * react-image-lightbox 2.0.0
 * Copyright 2016 Chris Fritz All rights reserved.
 * @license Open source under the MIT License
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _radium = require('radium');

var _radium2 = _interopRequireDefault(_radium);

var _Styles = require('./Styles');

var _Styles2 = _interopRequireDefault(_Styles);

var _Portal = require('./Portal');

var _Portal2 = _interopRequireDefault(_Portal);

var _Constant = require('./Constant');

var _Constant2 = _interopRequireDefault(_Constant);

function _getWindowWidth() {
    return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
}

function _getWindowHeight() {
    return window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
}

// Returns true if this window is rendered as an iframe inside another window
function _isInIframe() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

var ReactImageLightbox = _react2['default'].createClass({
    displayName: 'ReactImageLightbox',

    propTypes: {
        ///////////////////////////////
        // Image sources
        ///////////////////////////////

        // Main display image url
        mainSrc: _react.PropTypes.string.isRequired,

        // Previous display image url (displayed to the left)
        // If left undefined, movePrev actions will not be performed, and the button not displayed
        prevSrc: _react.PropTypes.string,

        // Next display image url (displayed to the right)
        // If left undefined, moveNext actions will not be performed, and the button not displayed
        nextSrc: _react.PropTypes.string,

        ///////////////////////////////
        // Image thumbnail sources
        ///////////////////////////////

        // Thumbnail image url corresponding to props.mainSrc
        mainSrcThumbnail: _react.PropTypes.string,

        // Thumbnail image url corresponding to props.prevSrc
        prevSrcThumbnail: _react.PropTypes.string,

        // Thumbnail image url corresponding to props.nextSrc
        nextSrcThumbnail: _react.PropTypes.string,

        ///////////////////////////////
        // Event Handlers
        ///////////////////////////////

        // Close window event
        // Should change the parent state such that the lightbox is not rendered
        onCloseRequest: _react.PropTypes.func.isRequired,

        // Move to previous image event
        // Should change the parent state such that props.prevSrc becomes props.mainSrc,
        //  props.mainSrc becomes props.nextSrc, etc.
        onMovePrevRequest: _react.PropTypes.func,

        // Move to next image event
        // Should change the parent state such that props.nextSrc becomes props.mainSrc,
        //  props.mainSrc becomes props.prevSrc, etc.
        onMoveNextRequest: _react.PropTypes.func,

        ///////////////////////////////
        // Download discouragement settings
        ///////////////////////////////

        // Enable download discouragement (prevents [right-click -> Save Image As...])
        discourageDownloads: _react.PropTypes.bool,

        ///////////////////////////////
        // Animation settings
        ///////////////////////////////

        // Disable all animation
        animationDisabled: _react.PropTypes.bool,

        // Disable animation on actions performed with keyboard shortcuts
        animationOnKeyInput: _react.PropTypes.bool,

        // Animation duration (ms)
        animationDuration: _react.PropTypes.number,

        ///////////////////////////////
        // Keyboard shortcut settings
        ///////////////////////////////

        // Required interval of time (ms) between key actions
        // (prevents excessively fast navigation of images)
        keyRepeatLimit: _react.PropTypes.number,

        // Amount of time (ms) restored after each keyup
        // (makes rapid key presses slightly faster than holding down the key to navigate images)
        keyRepeatKeyupBonus: _react.PropTypes.number,

        ///////////////////////////////
        // Image info
        ///////////////////////////////

        // Image title
        imageTitle: _react.PropTypes.node,

        ///////////////////////////////
        // Other
        ///////////////////////////////

        // Array of custom toolbar buttons
        toolbarButtons: _react.PropTypes.arrayOf(_react.PropTypes.node),

        // Padding (px) between the edge of the window and the lightbox
        imagePadding: _react.PropTypes.number,

        // When true, clicks outside of the image close the lightbox
        clickOutsideToClose: _react.PropTypes.bool
    },

    getDefaultProps: function getDefaultProps() {
        return {
            onMovePrevRequest: function onMovePrevRequest() {},
            onMoveNextRequest: function onMoveNextRequest() {},

            discourageDownloads: false,

            animationDisabled: false,
            animationOnKeyInput: false,
            animationDuration: 300,

            keyRepeatLimit: 180,
            keyRepeatKeyupBonus: 40,

            imagePadding: 10,
            clickOutsideToClose: true
        };
    },

    getInitialState: function getInitialState() {
        return {
            ///////////////////////////////
            // Animation
            ///////////////////////////////

            // Lightbox is closing
            // When Lightbox is mounted, if animation is enabled it will open with the reverse of the closing animation
            isClosing: !this.props.animationDisabled,

            // Component parts should animate (e.g., when images are moving, or image is being zoomed)
            shouldAnimate: false,

            ///////////////////////////////
            // Zoom settings
            ///////////////////////////////
            // Zoom level of image
            zoomLevel: _Constant2['default'].MIN_ZOOM_LEVEL,

            ///////////////////////////////
            // Image position settings
            ///////////////////////////////
            // Horizontal offset from center
            offsetX: 0,

            // Vertical offset from center
            offsetY: 0
        };
    },

    componentWillMount: function componentWillMount() {
        // Whether event listeners for keyboard and mouse input have been attached or not
        this.listenersAttached = false;

        // Used to disable animation when changing props.mainSrc|nextSrc|prevSrc
        this.keyPressed = false;

        // Used to store load state / dimensions of images
        this.imageCache = {};

        // Time the last keydown event was called (used in keyboard action rate limiting)
        this.lastKeyDownTime = 0;

        // Used for debouncing window resize event
        this.resizeTimeout = null;

        // Used to determine when actions are triggered by the scroll wheel
        /*this.wheelActionTimeout = null;
        this.resetScrollTimeout = null;
        this.scrollX            = 0;
        this.scrollY            = 0;*/

        // Used in panning zoomed images
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartOffsetX = 0;
        this.dragStartOffsetY = 0;

        // Used to differentiate between images with identical src
        this.keyCounter = 0;

        // Used to detect a move when all src's remain unchanged (four or more of the same image in a row)
        this.moveRequested = false;
    },

    componentDidMount: function componentDidMount() {
        this.attachListeners();

        if (!this.props.animationDisabled) {
            // Make opening animation play
            this.setState({ isClosing: false });
        }

        this.loadAllImages();
    },

    componentWillReceiveProps: function componentWillReceiveProps(nextProps) {
        var _this = this;

        var sourcesChanged = this.getSrcTypes().some(function (srcType) {
            return _this.props[srcType.name] != nextProps[srcType.name];
        });

        if (sourcesChanged || this.moveRequested) {
            this.moveRequested = false;

            // Load any new images
            this.loadAllImages(nextProps);
        }
    },

    componentWillUnmount: function componentWillUnmount() {
        this.detachListeners();
    },

    // Handle user keyboard actions
    handleKeyInput: function handleKeyInput(event) {
        event.stopPropagation();

        // Ignore key input during animations
        if (this.isAnimating()) {
            return;
        }

        // Allow slightly faster navigation through the images when user presses keys repeatedly
        if (event.type === 'keyup') {
            this.lastKeyDownTime -= this.props.keyRepeatKeyupBonus;
            return;
        }

        var keyCode = event.which || event.keyCode;
        var key = {
            esc: 27,
            leftArrow: 37,
            rightArrow: 39
        };

        // Ignore key presses that happen too close to each other (when rapid fire key pressing or holding down the key)
        // But allow it if it's a lightbox closing action
        var currentTime = new Date();
        if (currentTime.getTime() - this.lastKeyDownTime < this.props.keyRepeatLimit && keyCode != key.esc) {
            return;
        }
        this.lastKeyDownTime = currentTime.getTime();

        switch (keyCode) {
            // ESC key closes the lightbox
            case key.esc:
                event.preventDefault();
                this.requestClose(event);
                break;

            // Left arrow key moves to previous image
            case key.leftArrow:
                if (!this.props.prevSrc) {
                    return;
                }

                event.preventDefault();
                this.keyPressed = true;
                this.requestMovePrev(event);
                break;

            // Right arrow key moves to next image
            case key.rightArrow:
                if (!this.props.nextSrc) {
                    return;
                }

                event.preventDefault();
                this.keyPressed = true;
                this.requestMoveNext(event);
                break;

            default:
        }
    },

    // Handle the window resize event
    handleWindowResize: function handleWindowResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(this.forceUpdate.bind(this), 100);
    },

    // Handle a mouse wheel event over the lightbox container
    handleOuterMousewheel: function handleOuterMousewheel(event) {
        // Prevent scrolling of the background
        event.preventDefault();
        event.stopPropagation(); /*
                                 const xThreshold = Constant.WHEEL_MOVE_X_THRESHOLD;
                                 let actionDelay = 0;
                                 const imageMoveDelay = 500;
                                 clearTimeout(this.resetScrollTimeout);
                                 this.resetScrollTimeout = setTimeout(() => {
                                 this.scrollX = 0;
                                 this.scrollY = 0;
                                 }, 300);
                                 // Prevent rapid-fire zoom behavior
                                 if (this.wheelActionTimeout !== null || this.isAnimating()) {
                                 return;
                                 }
                                 if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
                                 // handle horizontal scrolls with image moves
                                 this.scrollY = 0;
                                 this.scrollX += event.deltaX;
                                 const bigLeapX = xThreshold / 2;
                                 // If the scroll amount has accumulated sufficiently, or a large leap was taken
                                 if (this.scrollX >= xThreshold || event.deltaX >= bigLeapX) {
                                 // Scroll right moves to next
                                 this.requestMoveNext(event);
                                 actionDelay = imageMoveDelay;
                                 this.scrollX = 0;
                                 } else if (this.scrollX <= -1 * xThreshold || event.deltaX <= -1 * bigLeapX) {
                                 // Scroll left moves to previous
                                 this.requestMovePrev(event);
                                 actionDelay = imageMoveDelay;
                                 this.scrollX = 0;
                                 }
                                 }
                                 // Allow successive actions after the set delay
                                 if (actionDelay !== 0) {
                                 this.wheelActionTimeout = setTimeout(() => {
                                 this.wheelActionTimeout = null;
                                 }, actionDelay);
                                 }*/
    },

    /*handleImageMouseWheel (event) {
        event.preventDefault();
        const yThreshold = Constant.WHEEL_MOVE_Y_THRESHOLD;
          if (Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
            event.stopPropagation();
            // If the vertical scroll amount was large enough, perform a zoom
            if (Math.abs(event.deltaY) < yThreshold) {
                return;
            }
              this.scrollX = 0;
            this.scrollY += event.deltaY;
              this.changeZoom(
                this.state.zoomLevel - event.deltaY,
                event.clientX,
                event.clientY
            );
        }
    },*/

    getOffsetXFromWindowCenter: function getOffsetXFromWindowCenter(x) {
        var windowWidth = _getWindowWidth();
        return windowWidth / 2 - x;
    },
    getOffsetYFromWindowCenter: function getOffsetYFromWindowCenter(y) {
        var windowHeight = _getWindowHeight();
        return windowHeight / 2 - y;
    },

    // Handle a double click on the current image
    handleImageDoubleClick: function handleImageDoubleClick(event) {
        if (this.state.zoomLevel > _Constant2['default'].MIN_ZOOM_LEVEL) {
            // A double click when zoomed in zooms all the way out
            this.changeZoom(_Constant2['default'].MIN_ZOOM_LEVEL, event.clientX, event.clientY);
        } else {
            // A double click when zoomed all the way out zooms in
            this.changeZoom(this.state.zoomLevel + _Constant2['default'].ZOOM_BUTTON_INCREMENT_SIZE, event.clientX, event.clientY);
        }
    },

    // Handle the mouse clicking down in the lightbox container
    handleOuterMouseDown: function handleOuterMouseDown(event) {
        event.preventDefault();

        // Allow dragging when zoomed
        if (this.state.zoomLevel > _Constant2['default'].MIN_ZOOM_LEVEL) {
            this.isDragging = true;
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            this.dragStartOffsetX = this.state.offsetX;
            this.dragStartOffsetY = this.state.offsetY;
        }
    },

    // Handle the mouse dragging over the lightbox container
    // (after a mouseDown and before a mouseUp event)
    handleOuterMouseMove: function handleOuterMouseMove(event) {
        if (!this.isDragging) {
            return;
        }

        var zoomMultiplier = this.getZoomMultiplier();

        var newOffsetX = (this.dragStartX - event.clientX) / zoomMultiplier + this.dragStartOffsetX;
        var newOffsetY = (this.dragStartY - event.clientY) / zoomMultiplier + this.dragStartOffsetY;
        if (this.state.offsetX !== newOffsetX || this.state.offsetY !== newOffsetY) {
            this.setState({
                offsetX: newOffsetX,
                offsetY: newOffsetY
            });
        }
    },

    // Handle a mouse click ending in the lightbox container
    handleMouseUp: function handleMouseUp() {
        var _this2 = this;

        if (!this.isDragging) {
            return;
        }

        this.isDragging = false;

        // Snap image back into frame if outside max offset range
        var maxOffsets = this.getMaxOffsets();
        var nextOffsetX = Math.max(maxOffsets.minX, Math.min(maxOffsets.maxX, this.state.offsetX));
        var nextOffsetY = Math.max(maxOffsets.minY, Math.min(maxOffsets.maxY, this.state.offsetY));
        if (nextOffsetX !== this.state.offsetX || nextOffsetY !== this.state.offsetY) {
            this.setState({
                offsetX: nextOffsetX,
                offsetY: nextOffsetY,
                shouldAnimate: true
            });

            setTimeout(function () {
                _this2.setState({ shouldAnimate: false });
            }, this.props.animationDuration);
        }
    },

    handleZoomInButtonClick: function handleZoomInButtonClick() {
        this.changeZoom(this.state.zoomLevel + _Constant2['default'].ZOOM_BUTTON_INCREMENT_SIZE);
    },

    handleZoomOutButtonClick: function handleZoomOutButtonClick() {
        this.changeZoom(this.state.zoomLevel - _Constant2['default'].ZOOM_BUTTON_INCREMENT_SIZE);
    },

    // Change zoom level
    changeZoom: function changeZoom(zoomLevel, clientX, clientY) {
        var windowWidth = _getWindowWidth();
        var windowHeight = _getWindowHeight();

        // Default to the center of the screen to zoom when no mouse position specified
        clientX = typeof clientX !== 'undefined' ? clientX : windowWidth / 2;
        clientY = typeof clientY !== 'undefined' ? clientY : windowHeight / 2;

        // Constrain zoom level to the set bounds
        var nextZoomLevel = Math.max(_Constant2['default'].MIN_ZOOM_LEVEL, Math.min(_Constant2['default'].MAX_ZOOM_LEVEL, zoomLevel));

        // Ignore requests that don't change the zoom level
        if (nextZoomLevel === this.state.zoomLevel) {
            return;
        } else if (nextZoomLevel === _Constant2['default'].MIN_ZOOM_LEVEL) {
            // Snap back to center if zoomed all the way out
            return this.setState({
                zoomLevel: nextZoomLevel,
                offsetX: 0,
                offsetY: 0
            });
        }

        var currentZoomMultiplier = this.getZoomMultiplier();
        var nextZoomMultiplier = this.getZoomMultiplier(nextZoomLevel);

        var percentXInCurrentBox = clientX / windowWidth;
        var percentYInCurrentBox = clientY / windowHeight;

        var currentBoxWidth = windowWidth / currentZoomMultiplier;
        var currentBoxHeight = windowHeight / currentZoomMultiplier;

        var nextBoxWidth = windowWidth / nextZoomMultiplier;
        var nextBoxHeight = windowHeight / nextZoomMultiplier;

        var deltaX = (nextBoxWidth - currentBoxWidth) * (percentXInCurrentBox - 0.5);
        var deltaY = (nextBoxHeight - currentBoxHeight) * (percentYInCurrentBox - 0.5);

        var nextOffsetX = this.state.offsetX - deltaX;
        var nextOffsetY = this.state.offsetY - deltaY;

        // When zooming out, limit the offset so things don't get left askew
        var maxOffsets = this.getMaxOffsets();
        if (this.state.zoomLevel > nextZoomLevel) {
            nextOffsetX = Math.max(maxOffsets.minX, Math.min(maxOffsets.maxX, nextOffsetX));
            nextOffsetY = Math.max(maxOffsets.minY, Math.min(maxOffsets.maxY, nextOffsetY));
        }

        this.setState({
            zoomLevel: nextZoomLevel,
            offsetX: nextOffsetX,
            offsetY: nextOffsetY
        });
    },

    // Request that the lightbox be closed
    requestClose: function requestClose(event) {
        var _this3 = this;

        // Call the parent close request
        var closeLightbox = function closeLightbox() {
            return _this3.props.onCloseRequest(event);
        };

        if (this.props.animationDisabled || event.type === 'keydown' && !this.props.animationOnKeyInput) {
            // No animation
            return closeLightbox();
        } else {
            // With animation

            // Start closing animation
            this.setState({ isClosing: true });

            // Perform the actual closing at the end of the animation
            setTimeout(closeLightbox, this.props.animationDuration);
        }
    },

    requestMove: function requestMove(direction, event) {
        var _this4 = this;

        // Reset the zoom level on image move
        var nextState = {
            zoomLevel: _Constant2['default'].MIN_ZOOM_LEVEL,
            offsetX: 0,
            offsetY: 0
        };

        // Enable animated states
        if (!this.props.animationDisabled && (!this.keyPressed || this.props.animationOnKeyInput)) {
            nextState.shouldAnimate = true;
            setTimeout(function () {
                return _this4.setState({ shouldAnimate: false });
            }, this.props.animationDuration);
        }
        this.keyPressed = false;

        this.moveRequested = true;

        if (direction === 'prev') {
            this.keyCounter--;
            this.setState(nextState);
            this.props.onMovePrevRequest(event);
        } else {
            this.keyCounter++;
            this.setState(nextState);
            this.props.onMoveNextRequest(event);
        }
    },

    // Request to transition to the previous image
    requestMovePrev: function requestMovePrev(event) {
        this.requestMove('prev', event);
    },

    // Request to transition to the next image
    requestMoveNext: function requestMoveNext(event) {
        this.requestMove('next', event);
    },

    closeIfClickInner: function closeIfClickInner(event) {
        if (event.target.className.search(/\binner\b/) > -1) {
            this.requestClose(event);
        }
    },

    // Attach key and mouse input events
    attachListeners: function attachListeners() {
        if (!this.listenersAttached) {
            document.addEventListener('keydown', this.handleKeyInput);
            document.addEventListener('keyup', this.handleKeyInput);
            window.addEventListener('resize', this.handleWindowResize);
            window.addEventListener('mouseup', this.handleMouseUp);

            // Have to add an extra mouseup handler to catch mouseup events outside of the window
            //  if the page containing the lightbox is displayed in an iframe
            if (_isInIframe()) {
                window.top.addEventListener('mouseup', this.handleMouseUp);
            }

            this.listenersAttached = true;
        }
    },

    // Detach key and mouse input events
    detachListeners: function detachListeners() {
        if (this.listenersAttached) {
            document.removeEventListener('keydown', this.handleKeyInput);
            document.removeEventListener('keyup', this.handleKeyInput);
            window.removeEventListener('resize', this.handleWindowResize);
            window.removeEventListener('mouseup', this.handleMouseUp);

            if (_isInIframe()) {
                window.top.removeEventListener('mouseup', this.handleMouseUp);
            }

            this.listenersAttached = false;
        }
    },

    // Get image src types
    getSrcTypes: function getSrcTypes() {
        return [{
            name: 'mainSrc',
            keyEnding: 'i' + this.keyCounter
        }, {
            name: 'mainSrcThumbnail',
            keyEnding: 't' + this.keyCounter
        }, {
            name: 'nextSrc',
            keyEnding: 'i' + (this.keyCounter + 1)
        }, {
            name: 'nextSrcThumbnail',
            keyEnding: 't' + (this.keyCounter + 1)
        }, {
            name: 'prevSrc',
            keyEnding: 'i' + (this.keyCounter - 1)
        }, {
            name: 'prevSrcThumbnail',
            keyEnding: 't' + (this.keyCounter - 1)
        }];
    },

    // Get sizing for when an image is larger than the window
    getFitSizes: function getFitSizes(width, height, stretch) {
        var windowHeight = _getWindowHeight();
        var windowWidth = _getWindowWidth();
        var maxHeight = windowHeight - this.props.imagePadding * 2;
        var maxWidth = windowWidth - this.props.imagePadding * 2;

        if (!stretch) {
            maxHeight = Math.min(maxHeight, height);
            maxWidth = Math.min(maxWidth, width);
        }

        var maxRatio = maxWidth / maxHeight;
        var srcRatio = width / height;

        var fitSizes = {};
        if (maxRatio > srcRatio) {
            // height is the constraining dimension of the photo
            fitSizes.width = width * maxHeight / height;
            fitSizes.height = maxHeight;
        } else {
            fitSizes.width = maxWidth;
            fitSizes.height = height * maxWidth / width;
        }

        return fitSizes;
    },

    // Get sizing when the image is scaled
    getZoomMultiplier: function getZoomMultiplier(zoomLevel) {
        zoomLevel = typeof zoomLevel !== 'undefined' ? zoomLevel : this.state.zoomLevel;
        return Math.pow(_Constant2['default'].ZOOM_RATIO, zoomLevel);
    },

    getMaxOffsets: function getMaxOffsets(zoomLevel) {
        zoomLevel = typeof zoomLevel !== 'undefined' ? zoomLevel : this.state.zoomLevel;
        var currentImageInfo = this.getBestImageForType('mainSrc');
        if (currentImageInfo === null) {
            return { maxX: 0, minX: 0, maxY: 0, minY: 0 };
        }

        var windowWidth = _getWindowWidth();
        var windowHeight = _getWindowHeight();
        var zoomMultiplier = this.getZoomMultiplier(zoomLevel);

        var maxX = 0;
        if (currentImageInfo.width - windowWidth / zoomMultiplier < 0) {
            // if there is still blank space in the X dimension, don't limit except to the opposite edge
            maxX = (windowWidth / zoomMultiplier - currentImageInfo.width) / 2;
        } else {
            maxX = (currentImageInfo.width - windowWidth / zoomMultiplier) / 2;
        }

        var maxY = 0;
        if (currentImageInfo.height - windowHeight / zoomMultiplier < 0) {
            // if there is still blank space in the Y dimension, don't limit except to the opposite edge
            maxY = (windowHeight / zoomMultiplier - currentImageInfo.height) / 2;
        } else {
            maxY = (currentImageInfo.height - windowHeight / zoomMultiplier) / 2;
        }

        return {
            maxX: maxX,
            minX: -1 * maxX,
            maxY: maxY,
            minY: -1 * maxY
        };
    },

    // Detach key and mouse input events
    isAnimating: function isAnimating() {
        return this.state.shouldAnimate || this.state.isClosing;
    },

    // Load image from src and call callback with image width and height on load
    loadImage: function loadImage(imageSrc, callback) {
        var _this5 = this;

        // Return the image info if it is already cached
        if (this.isImageLoaded(imageSrc)) {
            setTimeout(function () {
                callback(null, _this5.imageCache[imageSrc].width, _this5.imageCache[imageSrc].height);
            }, 1);
            return;
        }

        var that = this;
        var inMemoryImage = new Image();

        inMemoryImage.onerror = function () {
            callback('image load error');
        };

        inMemoryImage.onload = function () {
            that.imageCache[imageSrc] = {
                loaded: true,
                width: this.width,
                height: this.height
            };

            callback(null, this.width, this.height);
        };

        inMemoryImage.src = imageSrc;
    },

    // Load all images and their thumbnails
    loadAllImages: function loadAllImages(props) {
        var _this6 = this;

        props = props || this.props;
        var generateImageLoadedCallback = function generateImageLoadedCallback(srcType, imageSrc) {
            return function (err) {
                // Give up showing image on error
                if (err) {
                    if (window.console) {
                        window.console.warn(err);
                    }
                    return;
                }

                // Don't rerender if the src is not the same as when the load started
                if (_this6.props[srcType] != imageSrc) {
                    return;
                }

                // Force rerender with the new image
                _this6.forceUpdate();
            };
        };

        // Load the images
        this.getSrcTypes().forEach(function (srcType) {
            var type = srcType.name;

            // Load unloaded images
            if (props[type] && !_this6.isImageLoaded(props[type])) {
                _this6.loadImage(props[type], generateImageLoadedCallback(type, props[type]));
            }
        });
    },

    // Load image from src and call callback with image width and height on load
    isImageLoaded: function isImageLoaded(imageSrc) {
        return imageSrc && imageSrc in this.imageCache && this.imageCache[imageSrc].loaded;
    },

    // Get info for the best suited image to display with the given srcType
    getBestImageForType: function getBestImageForType(srcType) {
        var imageSrc = this.props[srcType];
        var fitSizes = {};

        if (this.isImageLoaded(imageSrc)) {
            // Use full-size image if available
            fitSizes = this.getFitSizes(this.imageCache[imageSrc].width, this.imageCache[imageSrc].height);
        } else if (this.isImageLoaded(this.props[srcType + 'Thumbnail'])) {
            // Fall back to using thumbnail if the image has not been loaded
            imageSrc = this.props[srcType + 'Thumbnail'];
            fitSizes = this.getFitSizes(this.imageCache[imageSrc].width, this.imageCache[imageSrc].height, true);
        } else {
            return null;
        }

        return {
            src: imageSrc,
            height: fitSizes.height,
            width: fitSizes.width
        };
    },

    render: function render() {
        var _this7 = this;

        // Transition settings for sliding animations
        var transitionStyle = {};
        if (!this.props.animationDisabled && this.isAnimating()) {
            transitionStyle = _Styles2['default'].imageAnimating(this.props.animationDuration);
        }

        // Key endings to differentiate between images with the same src
        var keyEndings = {};
        this.getSrcTypes().forEach(function (srcType) {
            keyEndings[srcType.name] = srcType.keyEnding;
        });

        // Images to be displayed
        var images = [];
        var addImage = function addImage(srcType, imageClass, baseStyle) {
            // Ignore types that have no source defined for their full size image
            if (!_this7.props[srcType]) {
                return;
            }

            var imageStyle = [_Styles2['default'].image, baseStyle, transitionStyle];
            if (_this7.state.zoomLevel > _Constant2['default'].MIN_ZOOM_LEVEL) {
                imageStyle.push({ cursor: 'move' });
            }

            var bestImageInfo = _this7.getBestImageForType(srcType);
            if (bestImageInfo === null) {
                // Fall back to loading icon if the thumbnail has not been loaded
                images.push(_react2['default'].createElement('div', {
                    className: imageClass + ' not-loaded',
                    style: imageStyle,
                    key: _this7.props[srcType] + keyEndings[srcType]
                }));

                return;
            }

            imageStyle.push({
                width: bestImageInfo.width,
                height: bestImageInfo.height
            });

            var imageSrc = bestImageInfo.src;
            if (_this7.props.discourageDownloads) {
                imageStyle.push({ backgroundImage: 'url(\'' + imageSrc + '\')' });
                imageStyle.push(_Styles2['default'].imageDiscourager);
                images.push(_react2['default'].createElement(
                    'div',
                    {
                        className: imageClass,
                        onDoubleClick: _this7.handleImageDoubleClick,
                        onWheel: _this7.handleImageMouseWheel,
                        style: imageStyle,
                        key: imageSrc + keyEndings[srcType]
                    },
                    _react2['default'].createElement('div', { className: 'download-blocker', style: [_Styles2['default'].downloadBlocker] })
                ));
            } else {
                images.push(_react2['default'].createElement('img', {
                    className: imageClass,
                    onDoubleClick: _this7.handleImageDoubleClick,
                    onWheel: _this7.handleImageMouseWheel,
                    style: imageStyle,
                    src: imageSrc,
                    //width={fullSize ? width : null}
                    key: imageSrc + keyEndings[srcType]
                }));
            }
        };

        var zoomMultiplier = this.getZoomMultiplier();
        // Next Image (displayed on the right)
        addImage('nextSrc', 'image-next', _Styles2['default'].imageNext);
        // Main Image
        addImage('mainSrc', 'image-current', _Styles2['default'].imageCurrent(zoomMultiplier, zoomMultiplier * this.state.offsetX, zoomMultiplier * this.state.offsetY));
        // Previous Image (displayed on the left)
        addImage('prevSrc', 'image-prev', _Styles2['default'].imagePrev);

        var noop = function noop() {};

        // Prepare styles and handlers for the zoom in/out buttons
        var zoomInButtonStyle = [_Styles2['default'].toolbarItemChild, _Styles2['default'].builtinButton, _Styles2['default'].zoomInButton];
        var zoomOutButtonStyle = [_Styles2['default'].toolbarItemChild, _Styles2['default'].builtinButton, _Styles2['default'].zoomOutButton];
        var zoomInButtonHandler = this.handleZoomInButtonClick;
        var zoomOutButtonHandler = this.handleZoomOutButtonClick;

        // Disable zooming in when zoomed all the way in
        if (this.state.zoomLevel === _Constant2['default'].MAX_ZOOM_LEVEL) {
            zoomInButtonStyle.push(_Styles2['default'].builtinButtonDisabled);
            zoomInButtonHandler = noop;
        }

        // Disable zooming out when zoomed all the way out
        if (this.state.zoomLevel === _Constant2['default'].MIN_ZOOM_LEVEL) {
            zoomOutButtonStyle.push(_Styles2['default'].builtinButtonDisabled);
            zoomOutButtonHandler = noop;
        }

        // Ignore clicks during animation
        if (this.isAnimating()) {
            zoomInButtonHandler = noop;
            zoomOutButtonHandler = noop;
        }

        return _react2['default'].createElement(
            _Portal2['default'],
            null,
            _react2['default'].createElement(
                _radium.StyleRoot,
                null,
                _react2['default'].createElement(
                    'div',
                    { // Floating modal with closing animations
                        className: 'outer' + (this.state.isClosing ? ' closing' : ''),
                        onWheel: this.handleOuterMousewheel,
                        onMouseMove: this.handleOuterMouseMove,
                        onMouseDown: this.handleOuterMouseDown,
                        onMouseUp: this.handleOuterMouseUp,
                        style: [_Styles2['default'].outer, _Styles2['default'].outerAnimating(this.props.animationDuration, this.state.isClosing), this.state.isClosing ? _Styles2['default'].outerClosing : {}]
                    },
                    _react2['default'].createElement(
                        'div',
                        { // Image holder
                            className: 'inner',
                            onClick: this.props.clickOutsideToClose ? this.closeIfClickInner : noop,
                            style: [_Styles2['default'].inner]
                        },
                        images
                    ),
                    !this.props.prevSrc ? '' : _react2['default'].createElement('button', { // Move to previous image button
                        type: 'button',
                        className: 'prev-button',
                        key: 'prev',
                        style: [_Styles2['default'].navButtons, _Styles2['default'].navButtonPrev],
                        onClick: !this.isAnimating() ? this.requestMovePrev : noop // Ignore clicks during animation
                    }),
                    !this.props.nextSrc ? '' : _react2['default'].createElement('button', { // Move to next image button
                        type: 'button',
                        className: 'next-button',
                        key: 'next',
                        style: [_Styles2['default'].navButtons, _Styles2['default'].navButtonNext],
                        onClick: !this.isAnimating() ? this.requestMoveNext : noop // Ignore clicks during animation
                    }),
                    _react2['default'].createElement(
                        'div',
                        { // Lightbox toolbar
                            className: 'toolbar',
                            style: [_Styles2['default'].toolbar]
                        },
                        _react2['default'].createElement(
                            'ul',
                            { className: 'toolbar-left', style: [_Styles2['default'].toolbarSide, _Styles2['default'].toolbarLeftSide] },
                            _react2['default'].createElement(
                                'li',
                                { style: [_Styles2['default'].toolbarItem] },
                                _react2['default'].createElement(
                                    'span',
                                    { style: [_Styles2['default'].toolbarItemChild] },
                                    this.props.imageTitle
                                )
                            )
                        ),
                        _react2['default'].createElement(
                            'ul',
                            { className: 'toolbar-right', style: [_Styles2['default'].toolbarSide, _Styles2['default'].toolbarRightSide] },
                            !this.props.toolbarButtons ? '' : this.props.toolbarButtons.map(function (button, i) {
                                return _react2['default'].createElement(
                                    'li',
                                    { key: i, style: [_Styles2['default'].toolbarItem] },
                                    button
                                );
                            }),
                            _react2['default'].createElement(
                                'li',
                                { style: [_Styles2['default'].toolbarItem] },
                                _react2['default'].createElement('button', { // Lightbox zoom in button
                                    type: 'button',
                                    key: 'zoom-in',
                                    className: 'zoom-in',
                                    style: zoomInButtonStyle,
                                    onClick: zoomInButtonHandler
                                })
                            ),
                            _react2['default'].createElement(
                                'li',
                                { style: [_Styles2['default'].toolbarItem] },
                                _react2['default'].createElement('button', { // Lightbox zoom out button
                                    type: 'button',
                                    key: 'zoom-out',
                                    className: 'zoom-out',
                                    style: zoomOutButtonStyle,
                                    onClick: zoomOutButtonHandler
                                })
                            ),
                            _react2['default'].createElement(
                                'li',
                                { style: [_Styles2['default'].toolbarItem] },
                                _react2['default'].createElement('button', { // Lightbox close button
                                    type: 'button',
                                    key: 'close',
                                    className: 'close',
                                    style: [_Styles2['default'].toolbarItemChild, _Styles2['default'].builtinButton, _Styles2['default'].closeButton],
                                    onClick: !this.isAnimating() ? this.requestClose : noop // Ignore clicks during animation
                                })
                            )
                        )
                    )
                )
            )
        );
    }
});

module.exports = _radium2['default'].call(undefined, ReactImageLightbox);
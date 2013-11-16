angular.module('wami.recorder', [])

    .constant('wamiSettings', {

        // Audio options
        container: "wav",
        encoding : "pcm",
        sampleRate: 44100,
        numChannels : 2,
        interleaved: true,

        // SWF options
        swfUrl: 'Wami.swf',
        wmode: "transparent",
        swfWidth: 214,
        swfHeight: 137,
        noSecurityCheck: false,

        // Server options
        serverUrl: null,
        idPrefix: '',


        // Callbacks
        onRecorderLoaded: function () {},
        onRecorderReady: function () {},

        onRecorderSecurityGranted: function () {},
        onRecorderSecurityFailed: function () {},
        
        onRecordingStart: function () {},
        onRecordingFinish: function () {},
        onRecordingFail: function () {},

        onPlaybackStart: function () {},
        onPlaybackFinish: function () {},
        onPlaybackFail: function () {},

    })

    .factory('WamiRecorder', ['$log', 'wamiSettings',
        function ($log, wamiSettings) {

            function Recorder (options) {
                angular.extend(wamiSettings, options);
                this._options = wamiSettings;

                if (!this._options.serverUrl) {
                    $log.error('Wami: No serverUrl was specified. Please make sure that WamiRecord.init() is called with a url that points to a valid upload server.');
                    return;
                }

                if (!swfobject) {
                    $log.error('SWFObject was not found. Please make sure that the swfobject.js dependency has been included in the page.');
                    return;
                }

            }

            Recorder.prototype = {

                embed: function (containerId, loadedCallback) {
                    var self = this;
                    loadedCallback = loadedCallback ||
                        Wami.nameCallback(function () {
                            console.log('calling delegate');
                            self.delegateApi();
                        });
                    var flashVars = {
                        visible: false,
                        loadedCallback: loadedCallback
                    }

                    var params = {
                        allowScriptAccess: "always",
                        wmode: this._options.wmode
                    };

                    var container = document.getElementById(containerId);
                    container.style.position = 'absolute';
                    this._container = container;

                    var version = '10.0.0';
                    recorderDiv = document.createElement('div');
                    var recorderId = Wami.createID();
                    recorderDiv.setAttribute('id', recorderId);
                    recorderDiv.innerHTML = "WAMI requires Flash "
                                    + version
                                    + " or greater<br />https://get.adobe.com/flashplayer/";

                    container.appendChild(recorderDiv);

                    // This is the minimum size due to the microphone security panel
                    swfobject.embedSWF(
                        this._options.swfUrl,
                        recorderId,
                        this._options.swfWidth,
                        this._options.swfHeight,
                        version,
                        null,
                        flashVars,
                        params,
                        {},
                        function () {
                            self.recorder = document.getElementById(recorderId);
                        });

                    // Without this line, Firefox has a dotted outline of the flash
                    swfobject.createCSS("#" + recorderId, "outline:none");

                },

                embedSwf: function () {
                    
                },

                getSettings: function () {
                    var settings = this.recorder.getSettings();
                    settings.microphone.remembered = Wami._remembered;
                    return settings;                        
                },

                delegateApi: function () {
                    var self = this;
                    function delegate(name) {
                        self[name] = function() {
                            return self.recorder[name].apply(self.recorder, arguments);
                        }
                    }

                    delegate('startPlaying');
                    delegate('stopPlaying');
                    delegate('startRecording');
                    delegate('stopRecording');
                    delegate('startListening');
                    delegate('stopListening');
                    delegate('getRecordingLevel');
                    delegate('getPlayingLevel');
                    delegate('setSettings');

                    if (!this._options.noSecurityCheck) {
                        this.checkSecurity();
                    }

                },

                checkSecurity: function () {
                    var settings = this.recorder.getSettings();
                    console.log(settings);
                    if (settings.microphone.granted) {
                        console.log('granted');
                        this._options.onRecorderReady();
                    } else {

                        // Show any Flash settings panel you want:
                        // http://help.adobe.com/en_US/FlashPlatform/reference/actionscript/3/flash/system/SecurityPanel.html
                        this.showSecurity("audio", "Wami.show",
                            Wami.nameCallback(this.checkSecurity),
                            Wami.nameCallback(function (error) { console.error(error)}));
                    }
                },

                showSecurity: function(startfn, finishedfn, failfn) {
                    var self = this;
                    console.log(this._container);
                    var augmentedfn = Wami.nameCallback(function() {
                        self.checkRemembered(finishedfn);
                        self._container.style.cssText = "position: absolute;";
                    });

                    this._container.style.cssText = "position: absolute; z-index: 99999";

                    this.recorder.showSecurity(panel, startfn, augmentedfn, failfn);
                },

                checkRemembered: function(finishedfn) {
                    var id = Wami.createID();
                    var div = document.createElement('div');
                    div.style.top = '-999px';
                    div.style.left = '-999px';
                    div.setAttribute('id', id);
                    var body = document.getElementsByTagName('body').item(0);
                    body.appendChild(div);

                    var fn = Wami.nameCallback(function() {
                        var swf = document.getElementById(id);
                        Wami._remembered = swf.getSettings().microphone.granted;
                        Wami.swfobject.removeSWF(id);
                        eval(finishedfn + "()");
                    });

                    this.embed(id, fn);
                }

            }


            return {

                getRecorder: function (options) {
                    return new Recorder(options);
                },

            };
    }])

    .directive('wamiRecorder', ['WamiRecorder', function (WamiRecorder) {
        return {
            restrict: 'A',
            scope: {
                wamiRecorder: '='
            },
            link: function ($scope, $element, $attrs) {
                $scope.$watch('wamiRecorder', function (options) {
                    if (options) {

                        recorder = WamiRecorder.getRecorder(options);
                        recorder.embed($attrs.id);

                        $scope.startRecording = function () {
                            recorder.startRecording();
                        }

                        // angular.extend(wamiSettings, options);

                        // Wami.setup({
                        //     id: $attrs.id,
                        //     swfUrl: wamiSettings.swfUrl,
                        //     onReady: function () {
                        //         console.log('made it');
                        //     }
                        // })
                    }
                });
            }
        };
    }]);






// Define the native WAMI service
// This code is copy and pasted from https://code.google.com/p/wami-recorder/source/browse/example/client/recorder.js


var Wami = window.Wami || {};

Wami.createID = function() {
    return "wid" + ("" + 1e10).replace(/[018]/g, function(a) {
        return (a ^ Math.random() * 16 >> a / 4).toString(16)
    });
}

// Creates a named callback in WAMI and returns the name as a string.
Wami.nameCallback = function(cb, cleanup) {
    Wami._callbacks = Wami._callbacks || {};
    var id = Wami.createID();
    Wami._callbacks[id] = function() {
        if (cleanup) {
            Wami._callbacks[id] = null;
        }
        cb.apply(null, arguments);
    };
    var named = "Wami._callbacks['" + id + "']";
    return named;
}

// This method ensures that a WAMI recorder is operational, and that
// the following API is available in the Wami namespace. All functions
// must be named (i.e. cannot be anonymous).
//
// Wami.startPlaying(url, startfn = null, finishedfn = null, failedfn = null);
// Wami.stopPlaying()
//
// Wami.startRecording(url, startfn = null, finishedfn = null, failedfn = null);
// Wami.stopRecording()
//
// Wami.getRecordingLevel() // Returns a number between 0 and 100
// Wami.getPlayingLevel() // Returns a number between 0 and 100
//
// Wami.hide()
// Wami.show()
//
// Manipulate the WAMI recorder's settings. In Flash
// we need to check if the microphone permission has been granted.
// We might also set/return sample rate here, etc.
//
// Wami.getSettings();
// Wami.setSettings(options);
//
// Optional way to set up browser so that it's constantly listening
// This is to prepend audio in case the user starts talking before
// they click-to-talk.
//
// Wami.startListening()
//
Wami.setup = function(options) {
    if (Wami.startRecording) {
        // Wami's already defined.
        if (options.onReady) {
            options.onReady();
        }
        return;
    }

    // Assumes that swfobject.js is included if Wami.swfobject isn't
    // already defined.
    Wami.swfobject = Wami.swfobject || swfobject;

    if (!Wami.swfobject) {
        alert("Unable to find swfobject to help embed the SWF.");
    }

    var _options;
    setOptions(options);
    embedWamiSWF(_options.id, Wami.nameCallback(delegateWamiAPI));

    function supportsTransparency() {
        // Detecting the OS is a big no-no in Javascript programming, but
        // I can't think of a better way to know if wmode is supported or
        // not... since NOT supporting it (like Flash on Ubuntu) is a bug.
        return (navigator.platform.indexOf("Linux") == -1);
    }

    function setOptions(options) {
        // Start with default options
        _options = {
            swfUrl : "Wami.swf",
            onReady : function() {
                Wami.hide();
            },
            onSecurity : checkSecurity,
            onError : function(error) {
                alert(error);
            }
        };

        _options = angular.extend({}, _options, options);

        // Create a DIV for the SWF under _options.id

        var container = document.createElement('div');
        container.style.position = 'absolute';
        _options.cid = Wami.createID();
        container.setAttribute('id', _options.cid);

        var swfdiv = document.createElement('div');
        var id = Wami.createID();
        swfdiv.setAttribute('id', id);

        container.appendChild(swfdiv);
        document.getElementById(_options.id).appendChild(container);

        _options.id = id;
    }

    function checkSecurity() {
        var settings = Wami.getSettings();
        if (settings.microphone.granted) {
            _options.onReady();
        } else {
            // Show any Flash settings panel you want:
            // http://help.adobe.com/en_US/FlashPlatform/reference/actionscript/3/flash/system/SecurityPanel.html
            Wami.showSecurity("privacy", "Wami.show", Wami
                    .nameCallback(_options.onSecurity), Wami
                    .nameCallback(_options.onError));
        }
    }

    // Embed the WAMI SWF and call the named callback function when loaded.
    function embedWamiSWF(id, initfn) {
        var flashVars = {
            visible : false,
            loadedCallback : initfn
        }

        var params = {
            allowScriptAccess : "always"
        }

        if (supportsTransparency()) {
            params.wmode = "transparent";
        }

        if (typeof console !== 'undefined') {
            flashVars.console = true;
        }

        var version = '10.0.0';
        document.getElementById(id).innerHTML = "WAMI requires Flash "
                + version
                + " or greater<br />https://get.adobe.com/flashplayer/";

        // This is the minimum size due to the microphone security panel
        Wami.swfobject.embedSWF(_options.swfUrl, id, 214, 137, version, null,
                flashVars, params);

        // Without this line, Firefox has a dotted outline of the flash
        Wami.swfobject.createCSS("#" + id, "outline:none");
    }

    // To check if the microphone settings were 'remembered', we
    // must actually embed an entirely new Wami client and check
    // whether its microphone is granted. If it is, it was remembered.
    function checkRemembered(finishedfn) {
        var id = Wami.createID();
        var div = document.createElement('div');
        div.style.top = '-999px';
        div.style.left = '-999px';
        div.setAttribute('id', id);
        var body = document.getElementsByTagName('body').item(0);
        body.appendChild(div);

        var fn = Wami.nameCallback(function() {
            var swf = document.getElementById(id);
            Wami._remembered = swf.getSettings().microphone.granted;
            Wami.swfobject.removeSWF(id);
            eval(finishedfn + "()");
        });

        embedWamiSWF(id, fn);
    }

    // Attach all the audio methods to the Wami namespace in the callback.
    function delegateWamiAPI() {
        var recorder = document.getElementById(_options.id);

        function delegate(name) {
            Wami[name] = function() {
                return recorder[name].apply(recorder, arguments);
            }
        }
        delegate('startPlaying');
        delegate('stopPlaying');
        delegate('startRecording');
        delegate('stopRecording');
        delegate('startListening');
        delegate('stopListening');
        delegate('getRecordingLevel');
        delegate('getPlayingLevel');
        delegate('setSettings');

        // Append extra information about whether mic settings are sticky
        Wami.getSettings = function() {
            if (recorder.getSettings) {
                var settings = recorder.getSettings();
                settings.microphone.remembered = Wami._remembered;
                return settings;
            }
            else {
                return null;
            }
        }

        Wami.showSecurity = function(panel, startfn, finishedfn, failfn) {
            // Flash must be on top for this.
            var container = document.getElementById(_options.cid);

            var augmentedfn = Wami.nameCallback(function() {
                checkRemembered(finishedfn);
                container.style.cssText = "position: absolute;";
            });

            container.style.cssText = "position: absolute; z-index: 99999";

            recorder.showSecurity(panel, startfn, augmentedfn, failfn);
        }

        Wami.show = function() {
            if (!supportsTransparency()) {
                recorder.style.visibility = "visible";
            }
        }

        Wami.hide = function() {
            // Hiding flash in all the browsers is tricky. Please read:
            // https://code.google.com/p/wami-recorder/wiki/HidingFlash
            if (!supportsTransparency()) {
                recorder.style.visibility = "hidden";
            }
        }

        // If we already have permissions, they were previously 'remembered'
        if (recorder.getSettings) {
            Wami._remembered = recorder.getSettings().microphone.granted;
        }

        if (_options.onLoaded) {
            _options.onLoaded();
        }

        if (!_options.noSecurityCheck) {
            checkSecurity();
        }
    }
}
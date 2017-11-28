angular.module("bawApp.directives.ngAudio", [
        "bawApp.configuration"
])


.constant("ngAudioEvents", {
    volumeChanged: "ngAudio:volumeChanged",
    muteChanged: "ngAudio:muted",
    ended: "ended"
})

/**
 * A directive for binding the model to data off an audio element.
 * Most things are oneway bindings
 *
 * This directive is incomplete. The potential exists for many other cool bindings,
 * like a "isBuffering" binding.
 */

.directive("ngAudio", ["ngAudioEvents", "$parse", function (ngAudioEvents, $parse) {

    /* const */ var readyStates = {
        "haveNothing": 0,
        "haveMetadata": 1,
        "haveCurrentData": 2,
        "haveFutureData": 3,
        "haveEnoughData": 4
    };

    return {
        restrict: "A",
        template: `<source ng-repeat="key in sources.audioOrder"
            ng-src="{{sources.audio[key].url}}" src=""
            type="{{sources.audio[key].mediaType}}">
            Your browser does not support the audio element.`,
        link: function (scope, elements, attributes, controller) {
            var element = elements[0];


            if (element.nodeName !== "AUDIO") {
                throw "Cannot put ngAudio element on an element that is not a <audio />";
            }

            var expression;
            attributes.$observe("ngAudioModel", function (interpolatedValue) {
                expression = $parse(attributes.ngAudioModel);
            });

            var expression2;
            attributes.$observe("ngAudioSources", function (interpolatedValue) {
                expression2 = $parse(attributes.ngAudioSources);
                scope.$watch(function () {
                    return expression2(scope);
                }, function (newVal, oldVal) {
                    scope.sources = newVal;
                });
            });


            /*
             * FORWARD BINDING
             *
             * NOTE: only some properties are bound forward
             */

            var target;
            scope.$watch(function () {
                // expression is a function under normal circumstances
                // but it sometimes gets evaluated here before being set
                // in which case, return undefined
                if (expression) {
                    return expression(scope);
                } else {
                    return;
                }

            }, function (newValue, oldValue) {
                if (!newValue) {
                    return;
                }
                target = newValue;
                // attach modification functions to model
                target.play = play;
                target.pause = pause;
            });

            // volume
            scope.$watch(function () {
                return target ? target.volume : null;
            }, function updateVolume(newValue, oldValue) {
                element.volume = newValue;
            });

            // muted
            scope.$watch(function () {
                return target ? target.muted : null;
            }, function updateMuted(newValue, oldValue) {
                element.muted = newValue === null ? null : !!newValue;
            });

            // autoPlay
            scope.$watch(function () {
                return target ? target.autoPlay : false;
            }, function(newValue, oldValue) {
                element.autoplay = newValue;
            });

            // currentTime - this watcher is registered once there"s enough data loaded to seek
            var rafOn = false;
            var lastRafPosition = null;
            var watchPosition = function () {
                scope.$watch(function () {
                    return target ? target.position : null;
                }, function (newValue, oldValue) {
                    if (newValue !== null) {
                        // We must not forward bind constantly.
                        // This is an attempt to disable bind looping (creates jittery playback).
                        // Only a problem when playing (currentTime is constantly changing)
                        // - lastRafPosition stops the RAF from binding loop
                        // - on play and pause there are also additional position updates, so ignore those with the currentTime check
                        if (rafOn && (lastRafPosition === newValue || newValue === element.currentTime)) {
                            return;
                        }
                        element.currentTime = newValue;
                    }
                    // else ignore change
                });
            };

            function play() {
                element.play();
            }

            function pause() {
                element.pause();
            }

            /*
             * REVERSE BINDING
             */

            var propertiesToUpdate = ["duration", "src", "currentSrc", "playbackRate", "readyState"];
            function updateObject(src, dest) {
                for (var i = 0; i < propertiesToUpdate.length; i++) {
                    dest[propertiesToUpdate[i]] = src[propertiesToUpdate[i]];
                }
            }

            function updateState(event) {
                console.debug("ngAudio:audioElement:eventType: ", event ? event.type : "<unknown>", element.currentTime);

                if (scope.$root === null) {
                    return;
                }

                scope.$root.$safeApply(scope, function () {
                    if (attributes.ngAudioModel) {
                        var target = expression(scope);
                        if (!target) {
                            expression.assign(scope, {});
                            target = expression(scope);
                        }

                        target.currentState = event && event.type || "unknown";

                        updateObject(element ,target);

                        target.isPlaying = !element.paused;
                        target.canPlay = element.readyState >= readyStates.haveFutureData;

                        console.log("element.readyState", element.readyState);


                       // IMPORTANT - setting the position while playing is done by RAF.
                        // Do not set it here or else jittery playback will occur when any event is raised from the element.
                        // This includes resuming playback (from a paused state).
                        if (!target.isPlaying) {
                            target.position = element.currentTime;
                        }

                        if (target.volume != null) {
                            target.volume = element.volume;
                            scope.$emit(ngAudioEvents.volumeChanged, element.volume);
                        }

                        if (target.muted != null) {
                            target.muted = element.muted;
                            scope.$emit(ngAudioEvents.muteChanged, element.muted);
                        }
                    }
                    else {
                        scope.currentState = event && event.type || "unknown";
                        updateObject(element, scope);
                    }

                });
            }

            // https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Events/Media_events
            var events = {
                "abort": updateState,
                "canplay": updateState,
                "canplaythrough": updateState,
                "durationchange": updateState,
                "emptied": updateState,
                "ended": function(event){
                    updateState(event);

                    console.debug("ngAudio:audioEvent:ended");
                    scope.$emit(ngAudioEvents.ended, target);
                },
                "error": function (event) {
                    console.error("ngAudio:audioElement:errorEvent", event);
                    updateState(event);
                },

                "loadeddata": updateState,
                "loadedmetadata": function(event) {
                    watchPosition();
                    updateState(event);
                },
                "loadstart": updateState,
                "mozaudioavailable": undefined,
                "pause": updateState,
                "play": updateState,
                "playing": function (event) {
                    // restart request animation frame
                    audioElementPositionRAF();
                    updateState(event);
                },
                "progress": updateState,
                "ratechange": updateState,
                "seeked": updateState,
                "seeking": updateState,
                "suspend": updateState,
                // this event would update progress
                // however it does not update often enough and is not smooth
                // thus we use request animation frame instead
                "timeupdate": undefined,
                "volumechange": updateState,
                "waiting": updateState};

            angular.forEach(events, function (value, key) {
                if (value) {
                    element.addEventListener(key, value, false);
                }
            });

            // position binding - reverse (element to model)
            function audioElementPositionRAF() {
                rafOn = true;
                if (attributes.ngAudioModel) {
                    var target = scope.$eval(attributes.ngAudioModel);
                    if (target) {
                        var position = element.currentTime;
                        if (target.position !== position) {
                            //scope.$apply(function () {
                              target.position = position;
                            //});

                            lastRafPosition = position;

                            // trialing $digest, it is slightly faster than $watch and
                            // we don"t need all the logic of $watch
                            if (!scope.$$phase) {
                                scope.$digest();
                            }
                        }
                    }
                }

                // optimisation - do not request a new frame if element is paused
                // requires loop to be restarted on play event
                if (element.paused) {
                    rafOn = false;
                    return;
                }

                // need to request each new frame
                window.requestAnimationFrame(audioElementPositionRAF);
            }

            // initialise
            audioElementPositionRAF();

        }
    };
}]);
var bawds = bawds || angular.module('bawApp.directives', ['bawApp.configuration']);

bawds.directive('bawAnnotationViewer', [ 'conf.paths', function (paths) {

    function variance(x, y) {
        var fraction = x / y;
        return Math.abs(fraction - 1);
    }

    function calculateUnitConversions(sampleRate, window, imageWidth, imageHeight) {
        if (sampleRate === undefined || window === undefined || !imageWidth || !imageHeight) {
            console.warn("not enough information to calculate unit conversions");
            return { pixelsPerSecond: NaN, pixelsPerHertz: NaN};
        }

        // based on meta data only
        var nyquistFrequency = (sampleRate / 2.0),
            idealPps = sampleRate / window,
            idealPph = (window / 2.0) / nyquistFrequency;

        // intentionally use width to ensure the image is correct
        var spectrogramBasedAudioLength = (imageWidth * window) / sampleRate;
        var spectrogramPps = imageWidth / spectrogramBasedAudioLength;

        // intentionally use width to ensure image is correct
        // SEE https://github.com/QutBioacousticsResearchGroup/bioacoustic-workbench/issues/86
        imageHeight = (imageHeight % 2) === 1 ? imageHeight - 1 : imageHeight;
        var imagePph = imageHeight / nyquistFrequency;

        // do consistency check (tolerance = 2%)
        if (variance(idealPph, imagePph) > 0.02) {
            console.warn("the image height does not conform well with the meta data");
        }
        if (variance(idealPps, spectrogramPps) > 0.02) {
            console.warn("the image width does not3 conform well with the meta data");
        }

        console.info("unit update calculated successfully");
        return { pixelsPerSecond: spectrogramPps, pixelsPerHertz: imagePph, nyquistFrequency: nyquistFrequency, imageHeight: imageHeight };
    }

    function updateUnitConversions(scope, imageWidth, imageHeight) {
        var conversions = {};
        // TODO: calculate unit-conversions without image media
        if (scope.model.media && scope.model.media.spectrogram) {
            conversions = calculateUnitConversions(scope.model.media.sampleRate, scope.model.media.spectrogram.window,
                imageWidth, imageHeight);
        }

        var PRECISION = 6;

        return {
            conversions: conversions,
            pixelsToSeconds: function pixelsToSeconds(pixels) {
                var seconds = pixels / conversions.pixelsPerSecond;
                return seconds;
            },
            pixelsToHertz: function pixelsToHertz(pixels) {
                var hertz = pixels / conversions.pixelsPerHertz;
                return hertz;
            },
            secondsToPixels: function secondsToPixels(seconds) {
                var pixels = seconds * conversions.pixelsPerSecond;
                return pixels;
            },
            hertzToPixels: function hertzToPixels(hertz) {
                var pixels = hertz * conversions.pixelsPerHertz;
                return pixels;
            },
            invertHertz: function invertHertz(hertz) {
                return Math.abs(conversions.nyquistFrequency - hertz);
            },
            invertPixels: function invertPixels(pixels) {
                return Math.abs(conversions.imageHeight - pixels);
            }
        };
    }

    function resizeOrMoveWithApply(scope, audioEvent, box) {
        scope.$apply(function () {
            scope.__lastDrawABoxEditId__ = audioEvent.__localId__;
            var boxId = baw.parseInt(box.id);
            if (audioEvent.__localId__ === boxId) {
                audioEvent.highFrequencyHertz = scope.model.converters.invertHertz(scope.model.converters.pixelsToHertz(box.top || 0));
                audioEvent.startTimeSeconds = scope.model.converters.pixelsToSeconds(box.left || 0);
                audioEvent.endTimeSeconds = audioEvent.startTimeSeconds + scope.model.converters.pixelsToSeconds(box.width || 0);
                audioEvent.lowFrequencyHertz = audioEvent.highFrequencyHertz - scope.model.converters.pixelsToHertz(box.height || 0);
            }
            else {
                console.error("Box ids do not match on resizing or move event", audioEvent.__localId__, boxId);
            }
        });
    }

    function touchUpdatedField(audioEvent) {
        audioEvent.updatedAt = new Date();
    }

    function create(simpleBox, audioRecordingId, scope) {

        var audioEvent = new baw.Annotation(baw.parseInt(simpleBox.id), audioRecordingId);

        scope.model.audioEvents.push(audioEvent);
        touchUpdatedField(audioEvent);
        resizeOrMoveWithApply(audioEvent, simpleBox, scope);

        return audioEvent;
    }

    /**
     * Create an watcher for an audio event model.
     * The purpose is to allow for reverse binding from model -> drawabox
     * NB: interestingly, these watchers are bound to array indexes... not the objects in them.
     *  this means the object is not coupled to the watcher and is not affected by any operation on it.
     * @param scope
     * @param array
     * @param index
     * @param drawaboxInstance
     */
    function registerWatcher(scope, array, index, drawaboxInstance) {

        // create the watcher
        var watcherFunc = function () {
            return array[index];
        };

        // create the listener - the actual callback
        var listenerFunc = function audioEventToBoxWatcher(value) {

            if (value) {
                if (scope.__lastDrawABoxEditId__ === value.__localId__) {
                    scope.__lastDrawABoxEditId__ = undefined;
                    console.log("audioEvent watcher SKIPPED", value.__localId__, value.selected);
                    return;
                }

                console.log("audioEvent watcher fired", value.__localId__, value.selected);

                var top = scope.model.converters.invertPixels(scope.model.converters.hertzToPixels(value.highFrequencyHertz)),
                    left = scope.model.converters.secondsToPixels(value.startTimeSeconds),
                    width = scope.model.converters.secondsToPixels(value.endTimeSeconds - value.startTimeSeconds),
                    height = scope.model.converters.hertzToPixels(value.highFrequencyHertz - value.lowFrequencyHertz);

                drawaboxInstance.drawabox('setBox', value.__localId__, top, left, height, width, value.selected);
            }
        };

        // tag both for easy removal later
        var tag = "index" + index.toString();
        watcherFunc.__drawaboxWatcherForAudioEvent = tag;
        listenerFunc.__drawaboxWatcherForAudioEvent = tag;

        // don't know if I need deregisterer or not - use this to stop listening...
        // --
        // note the last argument sets up the watcher for compare equality (not reference).
        // this may cause memory / performance issues if the model gets too big later on
        var deregisterer = scope.$watch(watcherFunc, listenerFunc, true);
    }

    function watchAudioEvents(scope, drawaboxInstance) {
        var deregisterCollection;

        function collectionChanged(newCollection, oldCollection, scope) {
            console.log("audioEvents collection changed", newCollection, oldCollection);


            // now for all new events, add them to drawabox, if they are not there already!
            angular.forEach(scope.model.audioEvents, function (value, index) {
                var annotationViewerIndex = index;
                var element;

                // does the annotation exist in the DOM?
                // this means the annotation should not be present in the DOM, assert this
                var exists = drawaboxInstance.drawabox('exists', value.__localId__);
                if (exists[0] === false) {
                    // if not, add the annotation into the DOM
                    element = drawaboxInstance.drawabox('insert', value.__localId__)[0][0];
                }
                else {
                    // the element already exists
                    element = exists[0];
                }

                if (element && element.annotationViewerIndex === annotationViewerIndex) {
                    // things are peachy, no-op
                }
                else if (element.annotationViewerIndex === undefined) {
                    // the annotation has an element in the dom, but has not been set up for tracking
                    element.annotationViewerIndex = index;

                    // register for reverse binding
                    registerWatcher(scope, scope.model.audioEvents, annotationViewerIndex, scope.$canvas);
                }
                else {
                    throw "Array and elements on drawabox out of sync, shit fucked up";
                }
            });
        }

        deregisterCollection =
            scope.$watchCollection(function () {
                return scope.model.audioEvents;
            }, collectionChanged);

    }

    /**ȻɌɄƉ**/

    var UPDATER_DRAWABOX = "DRAWABOX";
    var UPDATER_PAGE_LOAD = "DRAWABOX";

    /**
     * Update the model. Events must be emitted from drawabox.
     * @param box
     */
    function drawaboxUpdatesModel(scope, annotation, box) {
        scope.$apply(function () {
            //scope.__lastDrawABoxEditId__ = audioEvent.__localId__;
            
            var boxId = baw.parseInt(box.id);
            if (annotation.__localId__ === boxId) {
                annotation.lastUpdater = UPDATER_DRAWABOX;
                annotation.highFrequencyHertz = scope.model.converters.invertHertz(scope.model.converters.pixelsToHertz(box.top || 0));
                annotation.startTimeSeconds = scope.model.converters.pixelsToSeconds(box.left || 0);
                annotation.endTimeSeconds = annotation.startTimeSeconds + scope.model.converters.pixelsToSeconds(box.width || 0);
                annotation.lowFrequencyHertz = annotation.highFrequencyHertz - scope.model.converters.pixelsToHertz(box.height || 0);
            }
            else {
                console.error("Box ids do not match on resizing or move event", annotation.__localId__, boxId);
            }
        });
    }

    function modelUpdatesDrawabox(scope, drawaboxInstance, annotation) {
        var top = scope.model.converters.invertPixels(scope.model.converters.hertzToPixels(annotation.highFrequencyHertz)),
            left = scope.model.converters.secondsToPixels(annotation.startTimeSeconds),
            width = scope.model.converters.secondsToPixels(annotation.endTimeSeconds - annotation.startTimeSeconds),
            height = scope.model.converters.hertzToPixels(annotation.highFrequencyHertz - annotation.lowFrequencyHertz);

        drawaboxInstance.drawabox('setBox', annotation.__localId__, top, left, height, width, annotation.selected);
    }

    function modelUpdatesServer(action, annotation) {

    }

    function serverUpdatesModel() {

    }

    /**
     * This method should be called when an Annotation model is updated.
     * There are four possible cases:
     *  1) Page load (Ȼ R ɄƉ)
     *  2) Single Edit change (ȻɌ UD)
     *  3) Drawabox change (C Ɍ UD)
     *  4) Server async return for (reverse ȻɌ U Ɖ)
     * @param changedAnnotation
     * @param oldAnnotation
     * @param scope
     */
    function modelUpdated(changedAnnotation, oldAnnotation, scope) {
        if (!changedAnnotation) {
            console.debug("AnnotationEditor:modelUpdated: Falsy annotation, skip update.", changedAnnotation.__localId__);
            return;
        }

        // invariants
        if (changedAnnotation.lastUpdater === UPDATER_DRAWABOX && changedAnnotation.isDirty !== true) {
            throw "AnnotationEditor:modelUpdated: Invalid state! If the last update came from drawabox then the the annotation must be dirty!";
        }
        if (changedAnnotation.lastUpdater === UPDATER_PAGE_LOAD && changedAnnotation.isDirty !== false) {
            throw "AnnotationEditor:modelUpdated: Invalid state! If the last update came from page load then the the annotation must NOT be dirty!";
        }
        if (changedAnnotation.toBeDeleted && changedAnnotation.isDirty !== true) {
            throw "AnnotationEditor:modelUpdated: Invalid state! If the the delete flag is set the annotation must be dirty!";
        }

        // if the last update was done by the drawabox control, do not propagate it back to drawabox
        if (annotation.lastUpdater === DRAWABOX) {
            // reset flag
            annotation.lastUpdater = null;
        }
        else {
            modelUpdatesDrawabox(scope, ??? ,changedAnnotation);
        }
    }


    /****/

    return {
        restrict: 'AE',
        scope: {
            model: '=model'
        },
        controller: 'AnnotationViewerCtrl',
        require: '', // ngModel?
        templateUrl: paths.site.files.annotationViewer,
        //            compile: function(element, attributes, transclude)  {
        //                // transform DOM
        //            },
        link: function (scope, $element, attributes, controller) {

            // assign a unique id to scope
            scope.id = Number.Unique();

            scope.$canvas = $element.find(".annotation-viewer img + div").first();
            scope.$image = $element.find("img");


            // init unit conversion
            function updateConverters() {
                if (scope.$image[0].src) {
                    var natHeight = scope.$image[0].naturalHeight;
                    if (natHeight === undefined) {
                        // TODO: handle better
                        throw "can't determine natural height!";
                    }
                    if (natHeight !== 0 && !baw.isPowerOfTwo(natHeight)) {
                        var croppedHeight = baw.closestPowerOfTwoBelow(natHeight);
                        console.warn("The natural height (" + natHeight +
                            "px) for image " + scope.$image[0].src +
                            " is not a power of two. The image has been cropped to " + croppedHeight + "px!");

                        scope.$image.height(croppedHeight);
                    }
                }
                scope.model.converters = updateUnitConversions(scope, scope.$image.width(), scope.$image.height());

                // redraw all boxes already drawn (hacky way to force angular to see these objects as dirty!)
                scope.model.audioEvents.forEach(function (value) {
                    value.forceDodgyUpdate = (value._forceDodgyUpdate || 0) + 1;
                });

            }

            scope.$watch('model.media.spectrogram.url', updateConverters);
            scope.$image[0].addEventListener('load', function () {
                scope.$apply(function () {
                    updateConverters();
                });
            }, false);
            updateConverters();

            // init drawabox
            if (!angular.isArray(scope.model.audioEvents)) {
                throw "Model not ready, audioEvents not an array.";
            }
            //scope.model.selectedAudioEvents = scope.model.selectedAudioEvents || [];

            scope.$canvas.drawabox({
                "selectionCallbackTrigger": "mousedown",

                "newBox": function (element, newBox) {
                    var newAudioEvent = create(newBox, scope.model.audioRecording.id, scope);
                    console.log("newBox", newBox, newAudioEvent);
                },
                "boxSelected": function (element, selectedBox) {
                    console.log("boxSelected", selectedBox);


                    scope.$apply(function () {

                        // support for multiple selections - remove the clear
                        // TODO: this is a very inefficient method of achieving this result
                        angular.forEach(scope.model.audioEvents, function (value, key) {
                            value.selected = false;
                        });

                        // new form of selecting
                        scope.model.audioEvents[element[0].annotationViewerIndex].selected = true;
                    });
                },
                "boxResizing": function (element, box) {
                    console.log("boxResizing");
                    resizeOrMoveWithApply(scope, scope.model.audioEvents[element[0].annotationViewerIndex], box);

                },
                "boxResized": function (element, box) {
                    console.log("boxResized");
                    resizeOrMoveWithApply(scope, scope.model.audioEvents[element[0].annotationViewerIndex], box);
                },
                "boxMoving": function (element, box) {
                    console.log("boxMoving");
                    resizeOrMoveWithApply(scope, scope.model.audioEvents[element[0].annotationViewerIndex], box);
                },
                "boxMoved": function (element, box) {
                    console.log("boxMoved");
                    resizeOrMoveWithApply(scope, scope.model.audioEvents[element[0].annotationViewerIndex], box);
                },
                "boxDeleted": function (element, deletedBox) {
                    console.log("boxDeleted");

                    scope.$apply(function () {
                        // TODO: i'm not sure how I should handle 'deleted' items yet
                        var itemToDelete = scope.model.audioEvents[element[0].annotationViewerIndex];
                        itemToDelete.deletedAt = (new Date());

                        // TODO: delete index bound watcher... do not change array layout, keep it sparse


                        //                            if (scope.model.selectedAudioEvents.length > 0) {
                        //                                var index = scope.model.selectedAudioEvents.indexOf(itemToDelete);
                        //
                        //                                if (index >= 0) {
                        //                                    scope.model.selectedAudioEvents.splice(index, 1);
                        //                                }
                        //                            }
                    });
                }
            });

            // finally start watching the audioEvents collection for any changes!
            watchAudioEvents(scope, scope.$canvas);
        }
    };
}]);
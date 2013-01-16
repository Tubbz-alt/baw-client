"use strict";

/**
 * The listen controller. Show a spectrogram, listen to audio, annotate the spectrogram.
 * @param $scope
 * @param $element
 * @param $attrs
 * @param $transclude
 * @constructor
 */
function AnnotationViewerCtrl($scope, $element, $attrs, $transclude) {

    $scope.getTag = function getTag(id) {
        id = parseInt(id);
        if (id) {
            // TODO: SOME MAGIC, get tag label from a list that has hopefully already been loaded somewhere
            return "Magic Name " + id;
        }
        else {
            return "Unknown Tag Label";
        }
    };

    $scope.converters = (function () {
        // TODO: these are stubs and will need to be refactored

        // constants go here
        var me = $scope;

        return {
            pixelsToSeconds: function pixelsToSeconds(pixels) {
                var seconds = pixels * pixelsPerSecond;
                return seconds;
            },
            pixelsToHertz: function pixelsToHertz(pixels) {
                var hertz  = hetz * pixelsPerHertz;
                return value * 10;
            },
            secondsToPixels: function secondsToPixels(value) {
                return value / 10;
            },
            hertzToPixels: function hertzToPixels(value) {
                return value / 10;
            }
        };
    })();


}

function Annotation(localId, audioRecordingId) {
    if (!(this instanceof Annotation))
        throw new Error("Constructor called as a function");

    var now = new Date();

    this.__temporaryId__ = localId || Number.Unique();
    this.audioRecordingId = audioRecordingId;

    this.createdAt = now;
    this.updatedAt = now;

    this.endTimeSeconds = 0.0;
    this.highFrequencyHertz = 0.0;
    this.isReference = false;
    this.lowFrequencyHertz = 0.0;
    this.startTimeSeconds = 0.0;
    this.audioEventTags = [];
}

AnnotationViewerCtrl.$inject = ['$scope', '$element', '$attrs', '$transclude'];
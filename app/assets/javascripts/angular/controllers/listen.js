"use strict";
/*
    The listen controller. Show a spectrogram, listen to audio, annotate the spectrogram.
*/

function ListenCtrl($scope, $resource, $routeParams) {

    var recordingResource = $resource('/audio_recordings/:recordingId', {recordingId: '@recordingId'}, {
        get: { method:'GET', params:{recordingId: '@recordingId'}, isArray: false }
    });
    $scope.recording = recordingResource.get($routeParams);

    // HACK:
    $scope.recordingurl =  "/media/1bd0d668-1471-4396-adc3-09ccd8fe949a_0_120_0_11025.mp3";


    var spectrogramResource = $resource('/media/:recordingId', {recordingId: '@recordingId'}, {
        get: { method:'GET', params:{recordingId: '@recordingId'}, isArray: false }
    });
    $scope.spectrogram = spectrogramResource.get($routeParams);

    // HACK:
    $scope.spectrogram.url = "/media/1bd0d668-1471-4396-adc3-09ccd8fe949a_0_120_0_11025_512_g.png"

    var audioEventResource = $resource('/audio_events?by_audio_id=:recordingId', {recordingId: '@recordingId'}, {
        get: { method:'GET', params:{recordingId: '@recordingId'}, isArray: true }
    });
    $scope.audio_events = audioEventResource.get($routeParams);
    $scope.event_keys = function    () {
        return Object.keys($scope.audio_events[0]);
    }





    $scope.showHide = false;



}

ListenCtrl.$inject = ['$scope', '$resource', '$routeParams']
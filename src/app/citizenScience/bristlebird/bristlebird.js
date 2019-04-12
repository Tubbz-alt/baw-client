class BristlebirdAboutController {
    constructor($scope,
                $location,
                backgroundImage,
                paths) {

        $scope.citizenScientistName = "";

        $scope.getStarted = function () {
            localStorage.setItem("citizenScientistName", $scope.citizenScientistName);
            $location.path("/citsci/bristlebird/listen");
        };

        backgroundImage.currentBackground = paths.site.assets.backgrounds.citizenScience + "1.jpg";
    }
}


class BristlebirdController {
    constructor($scope,
                ngAudioEvents,
                $location,
                CitizenScienceCommon,
                CsSamples,
                CsLabels,
                SampleLabels,
                backgroundImage,
                paths,
                Question) {

        var self = this;

        /**
         * The name of the css project as it appears in the dataset definition
         * @type {string}
         */
        $scope.csProject = "ebb";

        /**
         * The duration of each audio sample
         * currently all samples will be the same duration (not set per sample in the dataset)
         * @type {number}
         */
        self.sampleDuration = 25;


        /**
         * The current sample object, including sample id
         * @type {number}
         */
        $scope.currentItem = CsSamples.currentItem;

        $scope.onPlayed = CsSamples.onPlayed;

        // to be populated after getting samples from dataset
        $scope.media = null;


        // load populate the onboarding steps as they are loaded.
        $scope.onboarding = {};

        $scope.onboarding.steps = [
            {
                element: ".citizen-science .spectrogram-wrapper",
                intro: "This shows a picture of the audio as a spectrogram."
            },
            {
                element: "dataset-progress button",
                intro: "This shows how many clips you have listened do, and lets you navigate between clips"
            },
            {
                element: ".autoplay",
                intro: "Switch this on to automatically progress to the next clip and play it."
            },
            {
                element: ".citizen-science-thumb",
                intro: "See if you can identify the events that are in these small spectrogram thumbnails in the audio clip above. " +
                "Tap the thumbnail for a closer look and to listen to the audio."
            },
            {
                element: ".label-check a",
                intro: "Use the checkbox to indicate if the this kind of even occurs in the audio clip above",

            }
        ];

        $scope.onboarding.callbacks = {
            onBeforeStart: function () {
                $scope.$broadcast("show-label-details");
            },
            onExit: function () {
                $scope.$broadcast("hide-label-details");
            }
        };



        /**
         * Labels that the user can select.
         * applies one or more tags which are not shown to the user.
         * example response from server
         *   [{
         *      "tags": ["ebb", "type1"],
         *      "name": "Eastern Bristlebird",
         *      "examples": [{
         *          "annotationId": 124730
         *      }, {
         *          "annotationId": 124727
         *      }, {
         *           "annotationId": 98378
         *       }]
         *   },
         *   {
         *       "tags": ["ground_parrot", "type1"],
         *       "name": "Ground Parrot",
         *       "examples": [{
         *           "annotationId": 124622
         *       }]
         *   },
         *   {
         *       "tags": ["quoll", "type1"],
         *       "label": "Spotted Quoll",
         *       "examples": []
         *   }];
         */

        $scope.labels = [];

        // the model passed to ngAudio
        $scope.audioElementModel = CitizenScienceCommon.getAudioModel();

        this.showAudio = CitizenScienceCommon.bindShowAudio($scope);

        //TODO: replace hardcoded value with routed study id
        $scope.study_id = 1;
        Question.questions($scope.study_id).then(x => {
            console.log("questions loaded", x);
            //TODO: update to allow multiple questions
            $scope.labels = x.data.data[0].questionData.labels;
            SampleLabels.init(x.data.data[0].id, $scope.study_id);
        });

        //SampleLabels.init($scope.csProject, $scope.samples, $scope.labels);

        /**
         * When the currentItem changes, change the current audio file / spectrogram to match it
         */
        $scope.$watch(function () {
            return CsSamples.currentItem();
            },
            function (item, oldVal) {
                if (item) {
                    self.showAudio(item.audioRecordingId, item.startTimeSeconds, item.endTimeSeconds);
                    // for now, we cycle through backgrounds arbitrarily, based on the id of the sample
                    // todo: store background images as part of the dataset or cs project
                    var backgroundPath = self.backgroundPaths[parseInt(item.id) % (self.backgroundPaths.length - 1)];
                    backgroundImage.currentBackground = backgroundPath;
                    $scope.$broadcast("update-selected-labels", SampleLabels.getLabelsForSample(item.id));

                }
            }, true);

        /**
         * auto play feature
         * when the playback arrives at the end of the audio, it will proceed to the next segment.
         * The url for the next segment will be returned from the nextLink function, which
         * is initialised to null, then reverse bound bound from the data progress component

         *TODO: make this work with non-url progress
         */
        //$scope.nextLink = null;
        $scope.$on(ngAudioEvents.ended, function navigate(event) {

            console.log(event);

            if (event.targetScope.audioElementModel === $scope.audioElementModel && $scope.audioElementModel.autoPlay) {
                $scope.$broadcast("autoNextTrigger");
            }
        });



        self.backgroundPaths = ["1.jpg", "2.jpg", "3.jpg", "4.jpg"].map(fn => paths.site.assets.backgrounds.citizenScience + fn);

    }

}

angular
    .module("bawApp.citizenScience.bristlebird", [
        "bawApp.components.progress",
        "bawApp.citizenScience.common",
        "bawApp.citizenScience.sampleLabels",
        "bawApp.components.citizenScienceThumbLabels",
        "bawApp.components.onboarding",
        "bawApp.components.background",
        "bawApp.citizenScience.csSamples",
        "bawApp.citizenScience.csLabels"
    ])
    .controller(
        "BristlebirdController",
        [
            "$scope",
            "ngAudioEvents",
            "$location",
            "CitizenScienceCommon",
            "CsSamples",
            "CsLabels",
            "SampleLabels",
            "backgroundImage",
            "conf.paths",
            "Question",
            BristlebirdController
        ])
    .controller(
        "BristlebirdAboutController",
        [
            "$scope",
            "$location",
            "backgroundImage",
            "conf.paths",
            BristlebirdAboutController
        ]);
